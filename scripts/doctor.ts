import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Check = {
	name: string
	ok: boolean
	detail: string
}

const root = process.cwd()
const packageJsonPath = resolve(root, 'package.json')
const checks: Check[] = []
const nodeMajor = Number(process.versions.node.split('.')[0])

checks.push({
	name: 'Node.js',
	ok: nodeMajor >= 20,
	detail: `detected ${process.version}; Node.js 20 or newer is required`
})

for (const relativePath of ['src', 'WAProto', 'tsconfig.build.json', 'yarn.lock']) {
	checks.push({
		name: relativePath,
		ok: existsSync(resolve(root, relativePath)),
		detail: existsSync(resolve(root, relativePath)) ? 'present' : 'missing'
	})
}

if (existsSync(packageJsonPath)) {
	const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
		name?: string
		packageManager?: string
	}

	checks.push({
		name: 'Package identity',
		ok: packageJson.name === '@cod3uchiha/walink',
		detail: packageJson.name ?? 'package name missing'
	})
	checks.push({
		name: 'Package manager',
		ok: packageJson.packageManager?.startsWith('yarn@4.') === true,
		detail: packageJson.packageManager ?? 'packageManager missing'
	})
}

const failed = checks.filter(check => !check.ok)

for (const check of checks) {
	console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`)
}

if (failed.length > 0) {
	console.error(`\nWAlink doctor found ${failed.length} problem(s).`)
	process.exitCode = 1
} else {
	console.log('\nWAlink environment is ready.')
}
