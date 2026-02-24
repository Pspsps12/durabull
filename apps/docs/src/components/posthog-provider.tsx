'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { Suspense, useEffect } from 'react'

const normalizeUrl = (value: string | undefined) => value?.trim()?.replace(/\/$/, '')

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
const webAppUrl = normalizeUrl(process.env.NEXT_PUBLIC_WEB_APP_URL)
const posthogHost = webAppUrl ? `${webAppUrl}/ingest` : undefined
const isProd = process.env.NODE_ENV === 'production'

let didWarnMissingConfig = false

function warnMissingPosthogConfig() {
  if (isProd || didWarnMissingConfig) return
  didWarnMissingConfig = true
  console.warn('[PostHog] Missing NEXT_PUBLIC_POSTHOG_KEY or NEXT_PUBLIC_WEB_APP_URL for docs')
}

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthogClient = usePostHog()

  useEffect(() => {
    if (!pathname || !posthogClient) return

    let url = window.origin + pathname
    if (searchParams.toString()) {
      url = `${url}?${searchParams.toString()}`
    }
    posthogClient.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams, posthogClient])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // Don't wrap with provider if PostHog isn't configured
  if (!posthogKey || !posthogHost) {
    warnMissingPosthogConfig()
    return <>{children}</>
  }

  return (
    <PHProvider
      apiKey={posthogKey}
      options={{
        api_host: posthogHost,
        ui_host: 'https://us.posthog.com',
        defaults: '2025-05-24',
        capture_pageview: false, // We'll capture manually for SPA navigation
        capture_pageleave: true,
        persistence: 'localStorage+cookie',
        cross_subdomain_cookie: true,
        debug: !isProd,
      }}
    >
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}
