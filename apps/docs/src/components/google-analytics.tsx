import { GoogleAnalytics } from '@next/third-parties/google'

const DEFAULT_MEASUREMENT_ID = 'G-JJBKDXZNQX'

export function MarketingGoogleAnalytics() {
  if (process.env.NODE_ENV !== 'production') {
    return null
  }

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || DEFAULT_MEASUREMENT_ID

  return <GoogleAnalytics gaId={gaId} />
}
