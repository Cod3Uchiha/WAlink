import { DisconnectReason } from '../../Types'
import { getWAlinkReconnectDecision } from '../../Walink/ReconnectPolicy'

describe('getWAlinkReconnectDecision', () => {
	it('does not reconnect a logged-out session', () => {
		expect(
			getWAlinkReconnectDecision({
				attempt: 0,
				statusCode: DisconnectReason.loggedOut
			})
		).toEqual({
			shouldReconnect: false,
			delayMs: 0,
			reason: 'disconnect status 401 requires a new session or operator action'
		})
	})

	it('uses bounded exponential backoff for transient disconnects', () => {
		expect(
			getWAlinkReconnectDecision({
				attempt: 3,
				statusCode: DisconnectReason.connectionLost,
				baseDelayMs: 1_000,
				maxDelayMs: 5_000,
				jitterRatio: 0,
				random: () => 0.5
			})
		).toEqual({
			shouldReconnect: true,
			delayMs: 5_000,
			reason: 'retryable disconnect status 408'
		})
	})

	it('stops after the configured attempt limit', () => {
		expect(
			getWAlinkReconnectDecision({
				attempt: 4,
				maxAttempts: 4
			}).shouldReconnect
		).toBe(false)
	})

	it('rejects invalid attempt values', () => {
		expect(() => getWAlinkReconnectDecision({ attempt: -1 })).toThrow(RangeError)
	})
})
