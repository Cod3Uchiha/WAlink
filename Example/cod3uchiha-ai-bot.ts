import type { Boom } from '@hapi/boom'
import { createInterface } from 'readline/promises'
import { stdin as input, stdout as output } from 'process'
import P from 'pino'
import {
	getWAlinkReconnectDecision,
	makeCacheableSignalKeyStore,
	makeWAlinkBot,
	useMultiFileAuthState,
	WAlinkMessageQueue,
	type WAlinkBot,
	type WAlinkChatMessage
} from '../src'

const API_ENDPOINT = process.env.COD3UCHIHA_AI_ENDPOINT || 'https://cod3uchiha.com/ai/copilot'
const AUTH_DIRECTORY = process.env.WALINK_AUTH_DIRECTORY || 'walink_bot_auth'
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 45_000)
const MAX_INPUT_LENGTH = 1_500
const MAX_WHATSAPP_CHUNK = 3_500

const logger = P({ level: process.env.LOG_LEVEL || 'info' })
const apiQueue = new WAlinkMessageQueue({
	concurrency: 2,
	intervalCap: 4,
	intervalMs: 1_000,
	maxRetries: 1,
	shouldRetry: error => error instanceof Error && !error.message.includes('Cloudflare')
})

const lastPrompt = new Map<string, string>()
const activeChats = new Set<string>()
let reconnectAttempt = 0
let pairingRequested = false

class Cod3UchihaApiError extends Error {
	constructor(
		message: string,
		readonly status?: number
	) {
		super(message)
		this.name = 'Cod3UchihaApiError'
	}
}

const extractAnswer = (payload: unknown): string | undefined => {
	if (typeof payload === 'string') return payload
	if (!payload || typeof payload !== 'object') return undefined

	const data = payload as Record<string, unknown>
	for (const key of ['result', 'results', 'response', 'answer', 'message', 'text']) {
		const value = data[key]
		if (typeof value === 'string' && value.trim()) return value.trim()
		if (value && typeof value === 'object') {
			const nested = extractAnswer(value)
			if (nested) return nested
		}
	}

	return undefined
}

const askCod3Uchiha = async (prompt: string): Promise<string> => {
	const url = new URL(API_ENDPOINT)
	url.searchParams.set('text', prompt)

	const response = await fetch(url, {
		headers: {
			accept: 'application/json',
			'user-agent': 'WAlinkBot/1.0 (+https://github.com/Cod3Uchiha/WAlink)'
		},
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
	})
	const contentType = response.headers.get('content-type') || ''
	const body = await response.text()

	if (response.status === 403 && /cloudflare|just a moment|challenge-platform/i.test(body)) {
		throw new Cod3UchihaApiError(
			'Cloudflare is challenging server requests. Add a Cloudflare WAF skip rule for public API routes such as /ai/*.',
			response.status
		)
	}

	if (!contentType.includes('application/json')) {
		throw new Cod3UchihaApiError(`Expected JSON but received ${contentType || 'an unknown response type'}`, response.status)
	}

	let payload: unknown
	try {
		payload = JSON.parse(body)
	} catch {
		throw new Cod3UchihaApiError('The API returned invalid JSON', response.status)
	}

	if (!response.ok) {
		throw new Cod3UchihaApiError(extractAnswer(payload) || `The API returned HTTP ${response.status}`, response.status)
	}

	const answer = extractAnswer(payload)
	if (!answer) throw new Cod3UchihaApiError('The API response did not contain an answer', response.status)
	return answer
}

const replyLong = async (message: WAlinkChatMessage, text: string) => {
	const chunks = text.match(new RegExp(`[\\s\\S]{1,${MAX_WHATSAPP_CHUNK}}`, 'g')) || [text]
	for (const chunk of chunks) {
		await message.reply(chunk.trim())
	}
}

const showMenu = async (message: WAlinkChatMessage) =>
	message.replyButtons({
		title: 'Cod3Uchiha AI Bot',
		text: 'Send any question and I will answer using the free Cod3Uchiha API.',
		footer: 'Powered by WAlink',
		buttons: [
			{ id: 'ask', text: 'Ask AI' },
			{ id: 'ping', text: 'Check bot' },
			{ type: 'url', text: 'API website', url: 'https://cod3uchiha.com/' }
		]
	})

const handleAiPrompt = async (message: WAlinkChatMessage, rawPrompt: string) => {
	const prompt = rawPrompt.trim()
	if (!prompt) {
		await message.reply('Send a question after `!ask`, or simply send your question normally.')
		return
	}

	if ([...prompt].length > MAX_INPUT_LENGTH) {
		await message.reply(`Please keep your message below ${MAX_INPUT_LENGTH} characters.`)
		return
	}

	if (activeChats.has(message.jid)) {
		await message.reply('I am still answering your previous message. Please wait.')
		return
	}

	activeChats.add(message.jid)
	lastPrompt.set(message.jid, prompt)

	try {
		await message.react('⏳')
		const answer = await apiQueue.add(() => askCod3Uchiha(prompt))
		await message.react('✅')
		await replyLong(message, answer)
	} catch (error) {
		logger.error({ error, jid: message.jid }, 'AI request failed')
		await message.react('❌').catch(() => undefined)

		const reason = error instanceof Error ? error.message : 'Unknown API error'
		await message.replyButtons({
			title: 'AI temporarily unavailable',
			text: reason,
			footer: `Endpoint: ${API_ENDPOINT}`,
			buttons: [
				{ id: 'retry', text: 'Try again' },
				{ type: 'url', text: 'Open API', url: 'https://cod3uchiha.com/' }
			]
		})
	} finally {
		activeChats.delete(message.jid)
	}
}

const registerBotHandlers = (bot: WAlinkBot) => {
	bot.command('menu', async ({ message }) => showMenu(message), { aliases: ['help', 'start'] })

	bot.command('ping', async ({ message }) => {
		const stats = apiQueue.stats()
		await message.reply(`Bot online. API queue: ${stats.pending} active, ${stats.queued} waiting.`)
	})

	bot.command('ask', async ({ message, input }) => {
		if (!input) {
			await message.reply('Send your question now, or use `!ask your question`.')
			return
		}

		await handleAiPrompt(message, input)
	})

	bot.command('retry', async ({ message }) => {
		const prompt = lastPrompt.get(message.jid)
		if (!prompt) {
			await message.reply('There is no previous question to retry.')
			return
		}

		await handleAiPrompt(message, prompt)
	})

	bot.onText(async message => {
		await handleAiPrompt(message, message.text)
	})
}

const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '')

const getPhoneNumber = async () => {
	const configured = normalizePhoneNumber(process.env.BOT_PHONE_NUMBER || '')
	if (configured) return configured

	const terminal = createInterface({ input, output })
	try {
		const entered = await terminal.question('Enter the WhatsApp number with country code, for example 2637...: ')
		return normalizePhoneNumber(entered)
	} finally {
		terminal.close()
	}
}

const startBot = async (): Promise<void> => {
	const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY)
	const { socket, bot } = makeWAlinkBot(
		{
			auth: {
				creds: state.creds,
				keys: makeCacheableSignalKeyStore(state.keys, logger)
			},
			logger
		},
		{
			prefix: '!',
			autoRead: true,
			onError: error => logger.error({ error }, 'bot handler failed')
		}
	)

	registerBotHandlers(bot)
	socket.ev.on('creds.update', saveCreds)
	socket.ev.on('connection.update', async update => {
		const { connection, lastDisconnect, qr } = update

		if (qr && !socket.authState.creds.registered && !pairingRequested) {
			pairingRequested = true
			const phoneNumber = await getPhoneNumber()
			if (!phoneNumber) throw new Error('A valid phone number is required for pairing')
			const pairingCode = await socket.requestPairingCode(phoneNumber)
			console.log(`\nPairing code: ${pairingCode}\n`)
		}

		if (connection === 'open') {
			reconnectAttempt = 0
			pairingRequested = false
			logger.info({ endpoint: API_ENDPOINT }, 'Cod3Uchiha AI bot connected')
		}

		if (connection === 'close') {
			bot.stop()
			const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode
			const decision = getWAlinkReconnectDecision({ attempt: reconnectAttempt, statusCode })

			if (!decision.shouldReconnect) {
				logger.error({ statusCode, reason: decision.reason }, 'Bot stopped')
				return
			}

			reconnectAttempt += 1
			logger.warn({ statusCode, delayMs: decision.delayMs }, 'Connection closed; reconnecting')
			setTimeout(() => void startBot(), decision.delayMs)
		}
	})
}

startBot().catch(error => {
	logger.fatal({ error }, 'Unable to start Cod3Uchiha AI bot')
	process.exitCode = 1
})
