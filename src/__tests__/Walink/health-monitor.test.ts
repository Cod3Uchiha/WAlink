import { WAlinkHealthMonitor } from '../../Walink/HealthMonitor'

describe('WAlinkHealthMonitor', () => {
	it('reports a healthy open connection', () => {
		const monitor = new WAlinkHealthMonitor()
		const health = monitor.update({ connection: 'open', isOnline: true })

		expect(health.status).toBe('healthy')
		expect(health.connection).toBe('open')
		expect(monitor.isReady()).toBe(true)
	})

	it('reports a restricted open connection as degraded', () => {
		const monitor = new WAlinkHealthMonitor()
		const health = monitor.update({
			connection: 'open',
			reachoutTimeLock: { isActive: true }
		})

		expect(health.status).toBe('degraded')
		expect(monitor.isReady()).toBe(false)
	})

	it('retains disconnect diagnostics', () => {
		const monitor = new WAlinkHealthMonitor()
		const error = new Error('connection lost')
		const date = new Date('2026-07-09T12:00:00.000Z')
		const health = monitor.update({
			connection: 'close',
			lastDisconnect: { error, date }
		})

		expect(health.status).toBe('offline')
		expect(health.lastError).toBe(error)
		expect(health.lastDisconnectAt).toEqual(date)
	})
})
