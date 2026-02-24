import type { Metadata } from 'next'
import { LandingLayout, MarketingPage } from '@/components'
import { createBreadcrumbSchema, createMetadata, createOrganizationSchema } from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'About',
    description:
      'Learn about Durabull, the team behind it, and our mission to bring clarity, reliability, and speed to BullMQ operations.',
    keywords: ['about Durabull', 'BullMQ dashboard team', 'queue monitoring company'],
  },
  '/about'
)

export default function AboutPage() {
  return (
    <LandingLayout>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            createOrganizationSchema(),
            createBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'About', url: '/about' },
            ]),
          ]),
        }}
      />
      <MarketingPage
        badge="Our Story"
        title="About Durabull"
        subtitle="We built Durabull to bring clarity, reliability, and speed to BullMQ operations."
        primaryCta={{ label: 'Meet the Team', to: '/contact' }}
        secondaryCta={{ label: 'View Product', to: '/product' }}
        sections={[
          {
            title: 'Built for Builders',
            description:
              'We are engineers who run job queues daily and wanted a dashboard we could trust.',
          },
          {
            title: 'Community-Driven',
            description: 'Durabull evolves with feedback from teams shipping BullMQ in production.',
          },
          {
            title: 'Long-Term Vision',
            description:
              'We are committed to open sourcing core components and supporting authless mode with stateful or stateless persistence options.',
          },
        ]}
        footerNote="Questions about Durabull? Email us at hello@durabull.io."
      />
    </LandingLayout>
  )
}
