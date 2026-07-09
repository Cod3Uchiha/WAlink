import PQueue from 'p-queue'

export type WAlinkMessageQueueOptions = {
	concurrency?: number
	intervalCap?: number
	intervalMs?: number
	maxRetries?: number
	retryDelayMs?: (attempt: number, error: unknown) => number
	shouldRetry?: (error: unknown) => boolean
}

export type WAlinkMessageQueueStats = {
	pending: number
	queued: number
	isPaused: boolean
}

const sleep = async (delayMs: number): Promise<void> => {
	if (delayMs <= 0) {
		return
	}

	await new Promise<void>(resolve => setTimeout(resolve, delayMs))
}

export class WAlinkMessageQueue {
	private readonly queue: PQueue
	private readonly maxRetries: number
	private readonly retryDelayMs: (attempt: number, error: unknown) => number
	private readonly shouldRetry: (error: unknown) => boolean

	constructor({
		concurrency = 1,
		intervalCap = 5,
		intervalMs = 1_000,
		maxRetries = 2,
		retryDelayMs = attempt => Math.min(30_000, 500 * 2 ** attempt),
		shouldRetry = () => true
	}: WAlinkMessageQueueOptions = {}) {
		if (concurrency < 1 || intervalCap < 1 || intervalMs < 1 || maxRetries < 0) {
			throw new RangeError('invalid WAlinkMessageQueue options')
		}

		this.queue = new PQueue({
			concurrency,
			intervalCap,
			interval: intervalMs
		})
		this.maxRetries = maxRetries
		this.retryDelayMs = retryDelayMs
		this.shouldRetry = shouldRetry
	}

	add<T>(task: () => Promise<T>): Promise<T> {
		return this.queue.add(async () => {
			let attempt = 0

			while (true) {
				try {
					return await task()
				} catch (error) {
					if (attempt >= this.maxRetries || !this.shouldRetry(error)) {
						throw error
					}

					await sleep(this.retryDelayMs(attempt, error))
					attempt += 1
				}
			}
		}, { throwOnTimeout: true })
	}

	pause(): void {
		this.queue.pause()
	}

	start(): void {
		this.queue.start()
	}

	clear(): void {
		this.queue.clear()
	}

	onIdle(): Promise<void> {
		return this.queue.onIdle()
	}

	stats(): WAlinkMessageQueueStats {
		return {
			pending: this.queue.pending,
			queued: this.queue.size,
			isPaused: this.queue.isPaused
		}
	}
}
