import type { Metadata } from 'next'
import { LandingLayout, MarketingPage } from '@/components'
import { createMetadata } from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'Changelog',
    description: "See what's new in Durabull — from fresh features to reliability upgrades.",
    keywords: ['Durabull changelog', 'BullMQ dashboard updates', 'product updates'],
  },
  '/changelog'
)

export default function ChangelogPage() {
  return (
    <LandingLayout>
      <MarketingPage
        badge="Product Updates"
        title="Changelog"
        subtitle="See what's new in Durabull — from fresh features to reliability upgrades."
        primaryCta={{ label: 'Start Free', to: '/signup' }}
        secondaryCta={{ label: 'View Roadmap', to: '/roadmap' }}
        sections={[
          {
            title: 'January 2026',
            description:
              'Improved queue observability with richer job timelines, retry context, and a faster live feed.',
          },
          {
            title: 'December 2025',
            description:
              'Launched team workspaces, scoped API keys, and bulk actions for queue operations.',
          },
          {
            title: 'October 2025',
            description:
              'Opened the Durabull beta with real-time dashboards, job inspection, and alerting hooks.',
          },
        ]}
        footerNote="Looking for a specific update? Email us at hello@durabull.io."
      />
    </LandingLayout>
  )
}
