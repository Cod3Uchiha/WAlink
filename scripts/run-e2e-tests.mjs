import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const jestPath = fileURLToPath(new URL('../node_modules/jest/bin/jest.js', import.meta.url))
const result = spawnSync(
	process.execPath,
	[
		'--experimental-vm-modules',
		jestPath,
		'--runInBand',
		'--forceExit',
		'--testMatch',
		'**/*.test-e2e.ts'
	],
	{
		stdio: 'inherit',
		env: {
			...process.env,
			NODE_TLS_REJECT_UNAUTHORIZED: '0'
		}
	}
)

if (result.error) {
	throw result.error
}

process.exit(result.status ?? 1)
