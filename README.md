# WAlink

WAlink is a lightweight TypeScript toolkit for building WhatsApp chatbots, AI assistants, customer-support bots, command bots, and notification responders.

It is based on [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys). WAlink keeps the upstream protocol, encryption, MIT license, history, and compatibility APIs while exposing a much smaller bot-facing interface.

> [!CAUTION]
> WAlink is not affiliated with WhatsApp or Meta. Do not use it for spam, unsolicited bulk messaging, stalkerware, surveillance, or activity that violates WhatsApp's terms.

## Focus

The recommended WAlink API is intentionally limited to chat-response workloads:

- receive normalized messages
- reply with text and media
- quick-reply, website, and call buttons
- single-select lists
- commands and aliases
- middleware
- AI-style response handlers
- reactions and read receipts
- notification helpers
- duplicate-message protection
- lightweight connection defaults

Advanced Baileys-compatible APIs remain available on the returned socket when an application needs them, but they are not required for ordinary bot development.

## Requirements

- Node.js 20 or newer
- Yarn 4 through Corepack

```bash
corepack enable
yarn install
```

## Install

Install directly from GitHub:

```bash
yarn add github:Cod3Uchiha/WAlink
```

After the package is published:

```bash
yarn add @cod3uchiha/walink
```

## Create a lightweight bot

```ts
import { makeWAlinkBot, useMultiFileAuthState } from '@cod3uchiha/walink'

const { state, saveCreds } = await useMultiFileAuthState('auth')
const { socket, bot } = makeWAlinkBot({ auth: state })

socket.ev.on('creds.update', saveCreds)

bot.onMessage(async message => {
	if (message.text.toLowerCase() === 'hello') {
		await message.reply('Hello. How can I help?')
	}
})
```

`makeWAlinkBot` disables full history synchronization by default and does not mark the account online merely because the connection opened.

## Commands

```ts
bot.command(
	'ping',
	async ({ message }) => {
		await message.reply('pong')
	},
	{
		aliases: ['p'],
		description: 'Check whether the bot is online'
	}
)
```

The default prefix is `!`, so the command is triggered by `!ping`. Configure one or more prefixes when creating the bot:

```ts
const { bot } = makeWAlinkBot(
	{ auth: state },
	{
		prefix: ['!', '/'],
		autoRead: true
	}
)
```

## Buttons

WAlink supports native-flow quick replies, website buttons, and call buttons:

```ts
await bot.sendButtons(jid, {
	title: 'Support',
	text: 'Choose an option',
	footer: 'WAlink Help Desk',
	buttons: [
		{ id: '!billing', text: 'Billing' },
		{ id: '!technical', text: 'Technical help' },
		{ type: 'url', text: 'Open website', url: 'https://example.com' },
		{ type: 'call', text: 'Call support', phoneNumber: '+263700000000' }
	]
})
```

Button IDs can contain commands. A button with the ID `!billing` is routed to the `billing` command automatically.

```ts
bot.command('billing', async ({ message }) => {
	await message.reply('Please send your invoice number.')
})
```

## Lists

```ts
await message.replyList({
	title: 'Customer support',
	text: 'What do you need help with?',
	buttonText: 'Open menu',
	sections: [
		{
			title: 'Departments',
			rows: [
				{ id: '!billing', title: 'Billing' },
				{
					id: '!technical',
					title: 'Technical support',
					description: 'Setup, connection, and account problems'
				}
			]
		}
	]
})
```

Selected button and list IDs are available as `message.selectedId` and are also used as `message.text` for simple routing.

## AI assistant

`respond` accepts a handler that returns text, buttons, or a list:

```ts
bot.respond(async message => {
	const answer = await myAI.generate(message.text)
	return answer
})
```

It can also return a structured response:

```ts
bot.respond(async message => ({
	type: 'buttons',
	text: `You said: ${message.text}`,
	buttons: [
		{ id: '!continue', text: 'Continue' },
		{ id: '!human', text: 'Talk to a person' }
	]
}))
```

## Customer-support middleware

```ts
bot.use(async (message, next) => {
	console.log({ sender: message.sender, text: message.text })
	await next()
})

bot.command(
	'agent',
	async ({ message }) => {
		await message.reply('A support agent will join shortly.')
	},
	{ privateOnly: true }
)
```

## Notifications

```ts
await bot.sendNotification(jid, {
	title: 'Payment received',
	body: 'Your payment was processed successfully.',
	footer: 'Reference: INV-1042',
	buttons: [{ type: 'url', text: 'View receipt', url: 'https://example.com/receipt/INV-1042' }]
})
```

Without buttons, the notification is sent as a lightweight formatted text message.

## Media replies

```ts
await bot.sendImage(jid, { url: 'https://example.com/image.jpg' }, 'Your image')
await bot.sendVideo(jid, { url: 'https://example.com/video.mp4' }, 'Your video')
await bot.sendAudio(jid, { url: 'https://example.com/audio.ogg' }, true)
await bot.sendDocument(jid, { url: 'https://example.com/invoice.pdf' }, 'application/pdf', 'invoice.pdf')
```

Incoming messages provide convenient reply methods:

```ts
bot.onMessage(async message => {
	await message.react('✅')
	await message.markRead()
	await message.replyButtons({
		text: 'Anything else?',
		buttons: [
			{ id: '!yes', text: 'Yes' },
			{ id: '!no', text: 'No' }
		]
	})
})
```

## Normalized message shape

Every handler receives a `WAlinkChatMessage` containing:

```ts
{
	id,
	jid,
	sender,
	pushName,
	fromMe,
	isGroup,
	timestamp,
	kind,
	text,
	selectedId,
	mentions,
	payload,
	raw
}
```

`raw` remains available when advanced protocol data is required.

## Existing socket

Attach the lightweight layer to an already-created socket:

```ts
import { createWAlinkBot, makeWAlinkSocket } from '@cod3uchiha/walink'

const socket = makeWAlinkSocket({ auth: state })
const bot = createWAlinkBot(socket)
```

## Reliability utilities

WAlink also provides:

- `WAlinkHealthMonitor`
- `getWAlinkReconnectDecision`
- `WAlinkMessageQueue`
- `yarn doctor`
- `yarn check`

The queue is intended for controlled application traffic. It is not an anti-spam bypass.

## Development

```bash
yarn doctor
yarn check
yarn example
```

Run the expensive end-to-end tests separately:

```bash
yarn test:e2e
```

## Migration from Baileys

The original low-level exports remain available for compatibility:

```ts
import makeWASocket, { makeWAlinkSocket } from '@cod3uchiha/walink'
```

WAlink does not rename wire-level protocol types because that would make upstream synchronization and existing integrations unnecessarily difficult.

## License and attribution

WAlink is distributed under the MIT License. See [`LICENSE`](LICENSE) and [`FORK_NOTICE.md`](FORK_NOTICE.md).
