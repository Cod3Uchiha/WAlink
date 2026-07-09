import { proto } from '../../WAProto/index.js'
import type makeWASocket from '../Socket'
import type { BaileysEventMap, WAMediaUpload, WAMessage, WAMessageKey } from '../Types'
import { generateWAMessageFromContent, getContentType, normalizeMessageContent } from '../Utils'
import { isJidGroup, isJidStatusBroadcast } from '../WABinary'

type WAlinkSocket = ReturnType<typeof makeWASocket>

export type WAlinkButton =
	| { type?: 'reply'; id: string; text: string }
	| { type: 'url'; text: string; url: string }
	| { type: 'call'; text: string; phoneNumber: string }

export type WAlinkListRow = {
	id: string
	title: string
	description?: string
}

export type WAlinkListSection = {
	title?: string
	rows: WAlinkListRow[]
}

export type WAlinkMessageKind =
	| 'text'
	| 'image'
	| 'video'
	| 'audio'
	| 'document'
	| 'sticker'
	| 'button'
	| 'list'
	| 'interactive'
	| 'unknown'

export type WAlinkSendTextOptions = {
	quoted?: WAMessage
	mentions?: string[]
}

export type WAlinkButtonsOptions = {
	text: string
	title?: string
	footer?: string
	buttons: WAlinkButton[]
	quoted?: WAMessage
}

export type WAlinkListOptions = {
	text: string
	title?: string
	footer?: string
	buttonText?: string
	sections: WAlinkListSection[]
	quoted?: WAMessage
}

export type WAlinkNotificationOptions = {
	title?: string
	body: string
	footer?: string
	buttons?: WAlinkButton[]
}

export type WAlinkBotReply =
	| string
	| ({ type: 'text'; text: string } & WAlinkSendTextOptions)
	| ({ type: 'buttons' } & Omit<WAlinkButtonsOptions, 'quoted'>)
	| ({ type: 'list' } & Omit<WAlinkListOptions, 'quoted'>)
	| null
	| undefined

export interface WAlinkChatMessage {
	raw: WAMessage
	key: WAMessageKey
	id: string
	jid: string
	sender: string
	pushName?: string | null
	fromMe: boolean
	isGroup: boolean
	timestamp: number
	kind: WAlinkMessageKind
	text: string
	selectedId?: string
	mentions: string[]
	payload?: Record<string, unknown>
	reply(text: string, options?: Omit<WAlinkSendTextOptions, 'quoted'>): Promise<WAMessage | undefined>
	replyButtons(options: Omit<WAlinkButtonsOptions, 'quoted'>): Promise<WAMessage>
	replyList(options: Omit<WAlinkListOptions, 'quoted'>): Promise<WAMessage>
	react(emoji: string): Promise<WAMessage | undefined>
	markRead(): Promise<void>
}

export type WAlinkMessageHandler = (message: WAlinkChatMessage) => void | Promise<void>

export type WAlinkMiddleware = (message: WAlinkChatMessage, next: () => Promise<void>) => void | Promise<void>

export type WAlinkCommandContext = {
	bot: WAlinkBot
	message: WAlinkChatMessage
	command: string
	args: string[]
	input: string
}

export type WAlinkCommandHandler = (context: WAlinkCommandContext) => void | Promise<void>

export type WAlinkCommandOptions = {
	aliases?: string[]
	description?: string
	groupOnly?: boolean
	privateOnly?: boolean
}

export type WAlinkBotOptions = {
	prefix?: string | string[]
	autoStart?: boolean
	autoRead?: boolean
	ignoreFromMe?: boolean
	notifyOnly?: boolean
	emitCommandsToMessageHandlers?: boolean
	maxDedupeSize?: number
	onError?: (error: unknown, message?: WAlinkChatMessage) => void | Promise<void>
}

type RegisteredCommand = {
	name: string
	handler: WAlinkCommandHandler
	options: WAlinkCommandOptions
}

type NativeFlowButton = {
	name: string
	buttonParamsJson: string
}

const textFromContent = (content: proto.IMessage) =>
	content.conversation ||
	content.extendedTextMessage?.text ||
	content.imageMessage?.caption ||
	content.videoMessage?.caption ||
	content.documentMessage?.caption ||
	content.buttonsResponseMessage?.selectedDisplayText ||
	content.templateButtonReplyMessage?.selectedDisplayText ||
	content.listResponseMessage?.title ||
	''

const nativeFlowPayload = (content: proto.IMessage) => {
	const paramsJson = content.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
	if (!paramsJson) {
		return undefined
	}

	try {
		return JSON.parse(paramsJson) as Record<string, unknown>
	} catch {
		return undefined
	}
}

const nestedString = (value: unknown, path: string[]): string | undefined => {
	let current = value
	for (const key of path) {
		if (!current || typeof current !== 'object') {
			return undefined
		}

		current = (current as Record<string, unknown>)[key]
	}

	return typeof current === 'string' ? current : undefined
}

const selectedIdFromContent = (content: proto.IMessage, payload?: Record<string, unknown>) =>
	content.buttonsResponseMessage?.selectedButtonId ||
	content.templateButtonReplyMessage?.selectedId ||
	content.listResponseMessage?.singleSelectReply?.selectedRowId ||
	nestedString(payload, ['id']) ||
	nestedString(payload, ['selected_id']) ||
	nestedString(payload, ['selectedId']) ||
	nestedString(payload, ['single_select_reply', 'selected_row_id']) ||
	nestedString(payload, ['singleSelectReply', 'selectedRowId'])

const contextInfoFromContent = (content: proto.IMessage) => {
	const type = getContentType(content)
	const value = type ? content[type] : undefined
	if (!value || typeof value !== 'object' || !('contextInfo' in value)) {
		return undefined
	}

	return value.contextInfo
}

const kindFromContent = (content: proto.IMessage): WAlinkMessageKind => {
	if (content.buttonsResponseMessage || content.templateButtonReplyMessage) return 'button'
	if (content.listResponseMessage) return 'list'
	if (content.interactiveResponseMessage) return 'interactive'
	if (content.imageMessage) return 'image'
	if (content.videoMessage) return 'video'
	if (content.audioMessage) return 'audio'
	if (content.documentMessage) return 'document'
	if (content.stickerMessage) return 'sticker'
	if (content.conversation || content.extendedTextMessage) return 'text'
	return 'unknown'
}

export const buildWAlinkNativeFlowButtons = (buttons: WAlinkButton[]): NativeFlowButton[] => {
	if (!buttons.length) {
		throw new Error('At least one button is required')
	}

	if (buttons.length > 10) {
		throw new Error('A maximum of 10 buttons is supported')
	}

	return buttons.map(button => {
		if (button.type === 'url') {
			return {
				name: 'cta_url',
				buttonParamsJson: JSON.stringify({
					display_text: button.text,
					url: button.url,
					merchant_url: button.url
				})
			}
		}

		if (button.type === 'call') {
			return {
				name: 'cta_call',
				buttonParamsJson: JSON.stringify({
					display_text: button.text,
					phone_number: button.phoneNumber
				})
			}
		}

		return {
			name: 'quick_reply',
			buttonParamsJson: JSON.stringify({
				display_text: button.text,
				id: button.id
			})
		}
	})
}

export const buildWAlinkListButton = (
	options: Pick<WAlinkListOptions, 'buttonText' | 'sections'>
): NativeFlowButton => {
	if (!options.sections.length || options.sections.every(section => !section.rows.length)) {
		throw new Error('At least one list row is required')
	}

	return {
		name: 'single_select',
		buttonParamsJson: JSON.stringify({
			title: options.buttonText || 'Choose an option',
			sections: options.sections
		})
	}
}

export class WAlinkBot {
	readonly socket: WAlinkSocket
	private readonly prefixes: string[]
	private readonly options: Required<
		Pick<
			WAlinkBotOptions,
			'autoRead' | 'ignoreFromMe' | 'notifyOnly' | 'emitCommandsToMessageHandlers' | 'maxDedupeSize'
		>
	> &
		Pick<WAlinkBotOptions, 'onError'>
	private readonly messageHandlers = new Set<WAlinkMessageHandler>()
	private readonly middleware: WAlinkMiddleware[] = []
	private readonly commands = new Map<string, RegisteredCommand>()
	private readonly seenMessageIds = new Set<string>()
	private started = false

	private readonly upsertListener = (event: BaileysEventMap['messages.upsert']) => {
		void this.handleUpsert(event)
	}

	constructor(socket: WAlinkSocket, options: WAlinkBotOptions = {}) {
		this.socket = socket
		this.prefixes = Array.isArray(options.prefix) ? options.prefix : [options.prefix ?? '!']
		this.options = {
			autoRead: options.autoRead ?? false,
			ignoreFromMe: options.ignoreFromMe ?? true,
			notifyOnly: options.notifyOnly ?? true,
			emitCommandsToMessageHandlers: options.emitCommandsToMessageHandlers ?? false,
			maxDedupeSize: options.maxDedupeSize ?? 1_000,
			onError: options.onError
		}

		if (options.autoStart !== false) {
			this.start()
		}
	}

	start() {
		if (!this.started) {
			this.socket.ev.on('messages.upsert', this.upsertListener)
			this.started = true
		}

		return this
	}

	stop() {
		if (this.started) {
			this.socket.ev.off('messages.upsert', this.upsertListener)
			this.started = false
		}

		return this
	}

	onMessage(handler: WAlinkMessageHandler) {
		this.messageHandlers.add(handler)
		return () => this.messageHandlers.delete(handler)
	}

	onText(handler: WAlinkMessageHandler) {
		return this.onMessage(message => {
			if (message.text) {
				return handler(message)
			}
		})
	}

	respond(handler: (message: WAlinkChatMessage) => WAlinkBotReply | Promise<WAlinkBotReply>) {
		return this.onText(async message => {
			const response = await handler(message)
			await this.replyWith(message, response)
		})
	}

	use(middleware: WAlinkMiddleware) {
		this.middleware.push(middleware)
		return () => {
			const index = this.middleware.indexOf(middleware)
			if (index >= 0) this.middleware.splice(index, 1)
		}
	}

	command(name: string, handler: WAlinkCommandHandler, options: WAlinkCommandOptions = {}) {
		const command: RegisteredCommand = { name: name.toLowerCase(), handler, options }
		const keys = [name, ...(options.aliases || [])].map(key => key.toLowerCase())
		for (const key of keys) {
			this.commands.set(key, command)
		}

		return () => {
			for (const key of keys) {
				if (this.commands.get(key) === command) this.commands.delete(key)
			}
		}
	}

	listCommands() {
		const unique = new Map<string, RegisteredCommand>()
		for (const command of this.commands.values()) unique.set(command.name, command)
		return [...unique.values()].map(command => ({
			name: command.name,
			description: command.options.description,
			aliases: command.options.aliases || []
		}))
	}

	async sendText(jid: string, text: string, options: WAlinkSendTextOptions = {}) {
		return this.socket.sendMessage(jid, { text, mentions: options.mentions }, { quoted: options.quoted })
	}

	async sendImage(jid: string, image: WAMediaUpload, caption?: string, quoted?: WAMessage) {
		return this.socket.sendMessage(jid, { image, caption }, { quoted })
	}

	async sendVideo(jid: string, video: WAMediaUpload, caption?: string, quoted?: WAMessage) {
		return this.socket.sendMessage(jid, { video, caption }, { quoted })
	}

	async sendAudio(jid: string, audio: WAMediaUpload, ptt = false, quoted?: WAMessage) {
		return this.socket.sendMessage(jid, { audio, ptt }, { quoted })
	}

	async sendDocument(
		jid: string,
		document: WAMediaUpload,
		mimetype: string,
		fileName?: string,
		caption?: string,
		quoted?: WAMessage
	) {
		return this.socket.sendMessage(jid, { document, mimetype, fileName, caption }, { quoted })
	}

	async sendButtons(jid: string, options: WAlinkButtonsOptions) {
		return this.sendInteractive(jid, {
			text: options.text,
			title: options.title,
			footer: options.footer,
			buttons: buildWAlinkNativeFlowButtons(options.buttons),
			quoted: options.quoted
		})
	}

	async sendList(jid: string, options: WAlinkListOptions) {
		return this.sendInteractive(jid, {
			text: options.text,
			title: options.title,
			footer: options.footer,
			buttons: [buildWAlinkListButton(options)],
			quoted: options.quoted
		})
	}

	async sendNotification(jid: string, options: WAlinkNotificationOptions) {
		if (options.buttons?.length) {
			return this.sendButtons(jid, {
				text: options.body,
				title: options.title,
				footer: options.footer,
				buttons: options.buttons
			})
		}

		const text = [options.title && `*${options.title}*`, options.body, options.footer].filter(Boolean).join('\n\n')
		return this.sendText(jid, text)
	}

	async replyWith(message: WAlinkChatMessage, response: WAlinkBotReply) {
		if (!response) return undefined
		if (typeof response === 'string') return message.reply(response)
		if (response.type === 'text') return message.reply(response.text, { mentions: response.mentions })
		if (response.type === 'buttons') return message.replyButtons(response)
		return message.replyList(response)
	}

	private async sendInteractive(
		jid: string,
		options: {
			text: string
			title?: string
			footer?: string
			buttons: NativeFlowButton[]
			quoted?: WAMessage
		}
	) {
		const userJid = this.socket.user?.id
		if (!userJid) {
			throw new Error('The socket must be connected before sending an interactive message')
		}

		const content = proto.Message.fromObject({
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2
					},
					interactiveMessage: {
						body: { text: options.text },
						footer: options.footer ? { text: options.footer } : undefined,
						header: {
							title: options.title,
							hasMediaAttachment: false
						},
						nativeFlowMessage: { buttons: options.buttons }
					}
				}
			}
		})
		const outbound = generateWAMessageFromContent(jid, content, {
			userJid,
			quoted: options.quoted
		})
		await this.socket.relayMessage(jid, outbound.message!, { messageId: outbound.key.id! })
		return outbound
	}

	private async handleUpsert(event: BaileysEventMap['messages.upsert']) {
		if (this.options.notifyOnly && event.type !== 'notify') return

		for (const raw of event.messages) {
			try {
				if (!raw.message || !raw.key.remoteJid || isJidStatusBroadcast(raw.key.remoteJid)) continue
				if (this.options.ignoreFromMe && raw.key.fromMe) continue
				if (raw.key.id && this.isDuplicate(raw.key.id)) continue

				const message = this.toChatMessage(raw)
				if (this.options.autoRead) await message.markRead()
				await this.runMiddleware(message, () => this.dispatch(message))
			} catch (error) {
				await this.reportError(error)
			}
		}
	}

	private toChatMessage(raw: WAMessage): WAlinkChatMessage {
		const content = normalizeMessageContent(raw.message) || {}
		const payload = nativeFlowPayload(content)
		const selectedId = selectedIdFromContent(content, payload)
		const contextInfo = contextInfoFromContent(content)
		const jid = raw.key.remoteJid!
		const sender = raw.key.participant || raw.participant || jid
		const text = selectedId || textFromContent(content) || ''

		return {
			raw,
			key: raw.key,
			id: raw.key.id || '',
			jid,
			sender,
			pushName: raw.pushName,
			fromMe: !!raw.key.fromMe,
			isGroup: !!isJidGroup(jid),
			timestamp: Number(raw.messageTimestamp || 0),
			kind: kindFromContent(content),
			text,
			selectedId,
			mentions: (contextInfo?.mentionedJid || []).filter((jid): jid is string => !!jid),
			payload,
			reply: (replyText, options = {}) => this.sendText(jid, replyText, { ...options, quoted: raw }),
			replyButtons: options => this.sendButtons(jid, { ...options, quoted: raw }),
			replyList: options => this.sendList(jid, { ...options, quoted: raw }),
			react: emoji => this.socket.sendMessage(jid, { react: { text: emoji, key: raw.key } }),
			markRead: async () => {
				await this.socket.readMessages([raw.key])
			}
		}
	}

	private async runMiddleware(message: WAlinkChatMessage, terminal: () => Promise<void>) {
		let index = -1
		const next = async (position: number): Promise<void> => {
			if (position <= index) throw new Error('next() called more than once')
			index = position
			const current = this.middleware[position]
			if (current) {
				await current(message, () => next(position + 1))
			} else {
				await terminal()
			}
		}

		await next(0)
	}

	private async dispatch(message: WAlinkChatMessage) {
		const matchedCommand = await this.dispatchCommand(message)
		if (matchedCommand && !this.options.emitCommandsToMessageHandlers) return

		for (const handler of this.messageHandlers) {
			await handler(message)
		}
	}

	private async dispatchCommand(message: WAlinkChatMessage) {
		const parsed = this.parseCommand(message)
		if (!parsed) return false
		const registered = this.commands.get(parsed.command)
		if (!registered) return false
		if (registered.options.groupOnly && !message.isGroup) return false
		if (registered.options.privateOnly && message.isGroup) return false

		await registered.handler({
			bot: this,
			message,
			command: registered.name,
			args: parsed.args,
			input: parsed.input
		})
		return true
	}

	private parseCommand(message: WAlinkChatMessage) {
		const input = (message.selectedId || message.text).trim()
		if (!input) return undefined

		let body: string | undefined
		for (const prefix of this.prefixes) {
			if (input.startsWith(prefix)) {
				body = input.slice(prefix.length).trim()
				break
			}
		}

		if (body === undefined && message.selectedId) body = input
		if (!body) return undefined

		const [command = '', ...args] = body.split(/\s+/)
		return {
			command: command.toLowerCase(),
			args,
			input: args.join(' ')
		}
	}

	private isDuplicate(id: string) {
		if (this.seenMessageIds.has(id)) return true
		this.seenMessageIds.add(id)
		while (this.seenMessageIds.size > this.options.maxDedupeSize) {
			const oldest = this.seenMessageIds.values().next().value
			if (!oldest) break
			this.seenMessageIds.delete(oldest)
		}

		return false
	}

	private async reportError(error: unknown, message?: WAlinkChatMessage) {
		if (this.options.onError) {
			await this.options.onError(error, message)
			return
		}

		console.error('[WAlinkBot]', error)
	}
}

export const createWAlinkBot = (socket: WAlinkSocket, options?: WAlinkBotOptions) => new WAlinkBot(socket, options)
