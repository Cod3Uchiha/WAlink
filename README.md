# WAlink

WAlink is a reliability-focused TypeScript WebSocket library for WhatsApp Web, maintained by [Cod3Uchiha](https://github.com/Cod3Uchiha).

It is based on [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) and keeps the upstream MIT license, history, protocol implementation, and compatibility API.

> [!CAUTION]
> WAlink is not affiliated with WhatsApp or Meta. Do not use it for spam, unsolicited bulk messaging, stalkerware, surveillance, or activity that violates WhatsApp's terms.

## What WAlink adds

- WAlink package and repository identity
- `makeWAlinkSocket` as a compatible socket-construction alias
- connection health monitoring
- bounded exponential reconnect decisions with jitter
- a rate-limited, retry-aware async message queue
- cross-platform unit and end-to-end test commands
- `yarn doctor` environment validation
- `yarn check` for type checking, linting, tests, and builds
- GitHub Actions validation

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

After the package is published, use:

```bash
yarn add @cod3uchiha/walink
```

## Basic connection

```ts
import { makeWAlinkSocket, useMultiFileAuthState } from '@cod3uchiha/walink'

const { state, saveCreds } = await useMultiFileAuthState('auth')
const socket = makeWAlinkSocket({ auth: state })

socket.ev.on('creds.update', saveCreds)
```

The original `makeWASocket` export remains available for compatibility.

## Connection health

```ts
import { WAlinkHealthMonitor } from '@cod3uchiha/walink'

const health = new WAlinkHealthMonitor()

socket.ev.on('connection.update', update => {
	const snapshot = health.update(update)
	console.log(snapshot.status)
})
```

Possible states are `starting`, `healthy`, `degraded`, and `offline`.

## Reconnect policy

```ts
import { DisconnectReason, getWAlinkReconnectDecision } from '@cod3uchiha/walink'

const decision = getWAlinkReconnectDecision({
	attempt: 2,
	statusCode: DisconnectReason.connectionLost
})

if (decision.shouldReconnect) {
	setTimeout(connect, decision.delayMs)
}
```

Logged-out, forbidden, bad-session, and multi-device-mismatch states are treated as non-retryable.

## Rate-limited queue

```ts
import { WAlinkMessageQueue } from '@cod3uchiha/walink'

const queue = new WAlinkMessageQueue({
	concurrency: 1,
	intervalCap: 5,
	intervalMs: 1_000,
	maxRetries: 2
})

await queue.add(() => socket.sendMessage(jid, { text: 'Hello from WAlink' }))
```

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

Most existing code can continue using the original exports while imports are migrated:

```ts
import makeWASocket from '@cod3uchiha/walink'
```

or:

```ts
import { makeWAlinkSocket } from '@cod3uchiha/walink'
```

WAlink does not rename wire-level protocol types because doing so would unnecessarily break downstream applications.

## Upstream documentation

The underlying socket, authentication, events, media, group, privacy, and message APIs remain based on Baileys. Refer to the [Baileys documentation](https://baileys.wiki/docs/intro/) while WAlink-specific documentation is expanded.

## License and attribution

WAlink is distributed under the MIT License. See [`LICENSE`](LICENSE) and [`FORK_NOTICE.md`](FORK_NOTICE.md).
