import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'
import { MarketingGoogleAnalytics } from '@/components/google-analytics'
import { PostHogProvider } from '@/components/posthog-provider'
import '@/styles/globals.css'
import '@/styles/landing.css'
import 'fumadocs-ui/style.css'
import '@/styles/docs-overrides.css'

export const metadata: Metadata = {
  title: {
    default: 'Durabull - BullMQ Admin Dashboard',
    template: '%s | Durabull',
  },
  description:
    'The modern BullMQ dashboard for browser, macOS, Windows, and self-hosted teams. Monitor jobs, debug failures, and scale queues with confidence.',
  metadataBase: new URL('https://durabull.io'),
  keywords: [
    'BullMQ',
    'Redis',
    'queue',
    'job queue',
    'background jobs',
    'admin dashboard',
    'monitoring',
    'Node.js',
  ],
  authors: [{ name: 'Durabull' }],
  creator: 'Durabull',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://durabull.io',
    title: 'Durabull - BullMQ Admin Dashboard',
    description:
      'The modern BullMQ dashboard for browser, macOS, Windows, and self-hosted teams. Monitor jobs, debug failures, and scale queues with confidence.',
    siteName: 'Durabull',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Durabull - BullMQ Admin Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Durabull - BullMQ Admin Dashboard',
    description:
      'The modern BullMQ dashboard for browser, macOS, Windows, and self-hosted teams. Monitor jobs, debug failures, and scale queues with confidence.',
    images: ['/og-image.png'],
    creator: '@durabullhq',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', type: 'image/png', sizes: '96x96' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        <MarketingGoogleAnalytics />
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  )
}
