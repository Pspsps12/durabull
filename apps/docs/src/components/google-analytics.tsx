import { GoogleAnalytics } from '@next/third-parties/google'

export function MarketingGoogleAnalytics() {
  if (process.env.NODE_ENV !== 'production') {
    return null
  }

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()
  if (!gaId) {
    return null
  }

  return <GoogleAnalytics gaId={gaId} />
}
