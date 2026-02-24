import type { Metadata } from 'next'
import { LandingLayout, MarketingPage } from '@/components'
import { createMetadata } from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'Community',
    description: 'Join the developers improving BullMQ operations and sharing best practices.',
    keywords: ['Durabull community', 'BullMQ community', 'queue management community'],
  },
  '/community'
)

export default function CommunityPage() {
  return (
    <LandingLayout>
      <MarketingPage
        badge="Connect with Us"
        title="Community"
        subtitle="Join the developers improving BullMQ operations and sharing best practices."
        primaryCta={{ label: 'Follow on X', to: 'https://x.com/durabullhq' }}
        secondaryCta={{ label: 'View on GitHub', to: 'https://github.com/durabullhq/durabull' }}
        sections={[
          {
            title: 'Office Hours',
            description: 'Monthly calls to discuss roadmap updates and queue ops tips.',
          },
          {
            title: 'Open Source',
            description:
              'Durabull is fully open source. Explore the codebase, self-host, and contribute on GitHub.',
          },
          {
            title: 'Community Stories',
            description: 'Share how you run BullMQ — we love spotlighting the community.',
          },
        ]}
        footerNote="Want to host a community session? Reach out at hello@durabull.io."
      />
    </LandingLayout>
  )
}
