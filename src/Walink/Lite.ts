import makeWASocket from '../Socket'
import type { UserFacingSocketConfig } from '../Types'
import { createWAlinkBot, type WAlinkBotOptions } from './Bot'

/**
 * Creates a socket configured for chat-response workloads and attaches the
 * lightweight WAlink bot API. Advanced Baileys-compatible APIs remain on the
 * returned socket when an application needs to drop down a level.
 */
export const makeWAlinkBot = (config: UserFacingSocketConfig, options?: WAlinkBotOptions) => {
	const socket = makeWASocket({
		...config,
		markOnlineOnConnect: config.markOnlineOnConnect ?? false,
		syncFullHistory: config.syncFullHistory ?? false,
		shouldSyncHistoryMessage: config.shouldSyncHistoryMessage ?? (() => false)
	})

	return {
		socket,
		bot: createWAlinkBot(socket, options)
	}
}
