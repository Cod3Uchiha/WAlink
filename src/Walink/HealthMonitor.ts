import type { ConnectionState, ReachoutTimelockState, WAConnectionState } from '../Types'

export type WAlinkHealthStatus = 'starting' | 'healthy' | 'degraded' | 'offline'

export type WAlinkHealthSnapshot = {
	status: WAlinkHealthStatus
	connection: WAConnectionState | 'unknown'
	isOnline?: boolean
	reachoutTimeLock?: ReachoutTimelockState
	lastDisconnectAt?: Date
	lastError?: Error
	lastUpdatedAt: Date
}

const normalizeError = (value: unknown): Error | undefined => {
	if (value instanceof Error) {
		return value
	}

	return value === undefined ? undefined : new Error(String(value))
}

export class WAlinkHealthMonitor {
	private snapshotValue: WAlinkHealthSnapshot = {
		status: 'starting',
		connection: 'unknown',
		lastUpdatedAt: new Date()
	}

	update(update: Partial<ConnectionState>): WAlinkHealthSnapshot {
		const connection = update.connection ?? this.snapshotValue.connection
		const reachoutTimeLock = update.reachoutTimeLock ?? this.snapshotValue.reachoutTimeLock
		const isRestricted = reachoutTimeLock?.isActive === true
		const lastDisconnectAt = update.lastDisconnect?.date ?? this.snapshotValue.lastDisconnectAt
		const lastError = update.lastDisconnect ? normalizeError(update.lastDisconnect.error) : this.snapshotValue.lastError

		let status: WAlinkHealthStatus
		if (connection === 'open' && !isRestricted) {
			status = 'healthy'
		} else if (connection === 'open' || connection === 'connecting') {
			status = 'degraded'
		} else {
			status = 'offline'
		}

		this.snapshotValue = {
			status,
			connection,
			isOnline: update.isOnline ?? this.snapshotValue.isOnline,
			reachoutTimeLock,
			lastDisconnectAt,
			lastError,
			lastUpdatedAt: new Date()
		}

		return this.snapshot()
	}

	snapshot(): WAlinkHealthSnapshot {
		return {
			...this.snapshotValue,
			reachoutTimeLock: this.snapshotValue.reachoutTimeLock ? { ...this.snapshotValue.reachoutTimeLock } : undefined
		}
	}

	isReady(): boolean {
		return this.snapshotValue.status === 'healthy'
	}
}
