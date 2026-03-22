import type { Metadata } from 'next'
import { CTA, FAQ, Features, Hero, LandingLayout, Screenshots } from '@/components'
import {
  createMetadata,
  createOrganizationSchema,
  createSoftwareApplicationSchema,
  createWebSiteSchema,
} from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'Durabull - BullMQ Admin Dashboard',
    description:
      'The modern BullMQ dashboard for browser, Apple Silicon macOS, Windows, and self-hosted teams. Monitor jobs, debug failures, and scale your background processing with confidence.',
    keywords: [
      'BullMQ',
      'Redis',
      'queue',
      'job queue',
      'background jobs',
      'admin dashboard',
      'monitoring',
      'Node.js',
      'Apple Silicon macOS app',
      'Windows app',
      'Homebrew',
    ],
  },
  '/'
)

export default function HomePage() {
  return (
    <LandingLayout>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            createWebSiteSchema(),
            createOrganizationSchema(),
            createSoftwareApplicationSchema(),
          ]),
        }}
      />
      <Hero />
      <Screenshots />
      <Features />
      <CTA />
      <FAQ />
    </LandingLayout>
  )
}
