import { DisconnectReason } from '../Types'

export type WAlinkReconnectDecision = {
	shouldReconnect: boolean
	delayMs: number
	reason: string
}

export type WAlinkReconnectPolicyOptions = {
	attempt: number
	statusCode?: number
	baseDelayMs?: number
	maxDelayMs?: number
	maxAttempts?: number
	jitterRatio?: number
	random?: () => number
}

const NON_RETRYABLE_STATUS_CODES = new Set<number>([
	DisconnectReason.loggedOut,
	DisconnectReason.badSession,
	DisconnectReason.multideviceMismatch,
	DisconnectReason.forbidden
])

export const getWAlinkReconnectDecision = ({
	attempt,
	statusCode,
	baseDelayMs = 1_000,
	maxDelayMs = 60_000,
	maxAttempts = 10,
	jitterRatio = 0.2,
	random = Math.random
}: WAlinkReconnectPolicyOptions): WAlinkReconnectDecision => {
	if (!Number.isInteger(attempt) || attempt < 0) {
		throw new RangeError('attempt must be a non-negative integer')
	}

	if (attempt >= maxAttempts) {
		return {
			shouldReconnect: false,
			delayMs: 0,
			reason: `maximum reconnect attempts reached (${maxAttempts})`
		}
	}

	if (statusCode !== undefined && NON_RETRYABLE_STATUS_CODES.has(statusCode)) {
		return {
			shouldReconnect: false,
			delayMs: 0,
			reason: `disconnect status ${statusCode} requires a new session or operator action`
		}
	}

	const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt)
	const boundedJitterRatio = Math.min(1, Math.max(0, jitterRatio))
	const jitter = exponentialDelay * boundedJitterRatio * (random() * 2 - 1)
	const delayMs = Math.max(0, Math.round(exponentialDelay + jitter))

	return {
		shouldReconnect: true,
		delayMs,
		reason: statusCode === undefined ? 'transient disconnect' : `retryable disconnect status ${statusCode}`
	}
}
