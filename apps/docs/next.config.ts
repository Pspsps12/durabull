import { createMDX } from 'fumadocs-mdx/next'
import type { NextConfig } from 'next'

const isStaticExport = process.env.NEXT_OUTPUT === 'export'
const withMDX = createMDX()

function getFirstNonEmptyEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return undefined
}

const publicWebAppUrl = getFirstNonEmptyEnv('NEXT_PUBLIC_WEB_APP_URL', 'APP_BASE_URL')
const publicPosthogKey = getFirstNonEmptyEnv('NEXT_PUBLIC_POSTHOG_KEY', 'POSTHOG_KEY')

const nextConfig: NextConfig = {
  output: isStaticExport ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  // Trailing slashes for static export compatibility
  trailingSlash: true,
  // Static docs builds still need public analytics/auth URLs baked into the client bundle.
  env: {
    ...(publicWebAppUrl ? { NEXT_PUBLIC_WEB_APP_URL: publicWebAppUrl } : {}),
    ...(publicPosthogKey ? { NEXT_PUBLIC_POSTHOG_KEY: publicPosthogKey } : {}),
  },
}

export default withMDX(nextConfig)
