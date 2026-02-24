import type { Metadata } from 'next'
import { LandingLayout, MarketingPage } from '@/components'
import { createMetadata } from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'Blog',
    description: 'Stories, launch notes, and engineering deep dives from the Durabull team.',
    keywords: ['Durabull blog', 'BullMQ articles', 'queue management blog'],
  },
  '/blog'
)

export default function BlogPage() {
  return (
    <LandingLayout>
      <MarketingPage
        badge="Durabull Blog"
        title="Blog"
        subtitle="Stories, launch notes, and engineering deep dives from the Durabull team."
        primaryCta={{ label: 'Join the Beta', to: '/signup' }}
        secondaryCta={{ label: 'Follow on X', to: 'https://x.com/durabullhq' }}
        sections={[
          {
            title: 'Engineering',
            description: 'How we build reliable queue observability at scale.',
          },
          {
            title: 'Product',
            description: 'Roadmap updates, feature spotlights, and beta announcements.',
          },
          {
            title: 'Community',
            description: 'Learn from teams shipping BullMQ in production.',
          },
        ]}
        footerNote="Want to contribute a story? Email us at hello@durabull.io."
      />
    </LandingLayout>
  )
}
