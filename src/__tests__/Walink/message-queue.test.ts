import { WAlinkMessageQueue } from '../../Walink/MessageQueue'

describe('WAlinkMessageQueue', () => {
	it('retries transient task failures', async () => {
		const queue = new WAlinkMessageQueue({
			intervalCap: 100,
			intervalMs: 1,
			maxRetries: 2,
			retryDelayMs: () => 0
		})
		let attempts = 0

		await expect(
			queue.add(async () => {
				attempts += 1
				if (attempts < 3) {
					throw new Error('temporary failure')
				}

				return 'sent'
			})
		).resolves.toBe('sent')
		expect(attempts).toBe(3)
	})

	it('does not retry errors rejected by the retry predicate', async () => {
		const queue = new WAlinkMessageQueue({
			intervalCap: 100,
			intervalMs: 1,
			maxRetries: 3,
			shouldRetry: () => false
		})
		let attempts = 0

		await expect(
			queue.add(async () => {
				attempts += 1
				throw new Error('permanent failure')
			})
		).rejects.toThrow('permanent failure')
		expect(attempts).toBe(1)
	})
})
