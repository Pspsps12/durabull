import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import rootPackage from '../../../package.json'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const apiRoot = join(scriptDir, '..')

function firstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }

  return null
}

const appVersion = firstNonEmpty(process.env.DURABULL_APP_VERSION, rootPackage.version) ?? '0.0.0'
const appBuildId =
  firstNonEmpty(
    process.env.DURABULL_BUILD_ID,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA
  ) ?? appVersion
const appBuildTime = firstNonEmpty(process.env.DURABULL_BUILD_TIME)

const result = await Bun.build({
  entrypoints: [join(apiRoot, 'src', 'index.ts')],
  target: 'bun',
  outdir: join(apiRoot, 'dist'),
  sourcemap: 'external',
  define: {
    __DURABULL_APP_VERSION__: JSON.stringify(appVersion),
    __DURABULL_BUILD_ID__: JSON.stringify(appBuildId),
    __DURABULL_BUILD_TIME__: JSON.stringify(appBuildTime ?? null),
  },
})

if (!result.success) {
  for (const log of result.logs) {
    console.error(log)
  }

  process.exit(1)
}
