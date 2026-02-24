import type { Metadata } from 'next'
import { LandingLayout, MarketingPage } from '@/components'
import { createMetadata } from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'API Reference',
    description: "Automate queue operations and observability with Durabull's REST endpoints.",
    keywords: ['Durabull API', 'BullMQ API', 'queue automation', 'REST API'],
  },
  '/api-reference'
)

export default function ApiReferencePage() {
  return (
    <LandingLayout>
      <MarketingPage
        badge="Developer APIs"
        title="API Reference"
        subtitle="Automate queue operations and observability with Durabull's REST endpoints."
        primaryCta={{ label: 'Get API Access', to: '/signup' }}
        secondaryCta={{ label: 'Browse Docs', to: '/docs' }}
        sections={[
          {
            title: 'Queues',
            description: 'Inspect queue health, pause/resume workers, and review throughput.',
            items: ['List queues', 'Toggle pause', 'Fetch metrics'],
          },
          {
            title: 'Jobs',
            description: 'Retrieve job history and automate retries.',
            items: ['Query by status', 'Retry or remove', 'View payload metadata'],
          },
          {
            title: 'Signals',
            description: 'Stream operational events to your tooling.',
            items: ['Webhook subscriptions', 'Alert thresholds', 'Status checks'],
          },
        ]}
        footerNote="API access is available during beta upon request."
      />
    </LandingLayout>
  )
}
