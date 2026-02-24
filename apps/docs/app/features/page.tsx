import type { Metadata } from 'next'
import { Features, LandingLayout } from '@/components'
import { createBreadcrumbSchema, createMetadata } from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'Features',
    description:
      'Powerful BullMQ dashboard features: real-time monitoring, job debugging, worker tracking, scheduled jobs, team collaboration, and more.',
    keywords: [
      'BullMQ features',
      'queue monitoring',
      'job debugging',
      'worker tracking',
      'scheduled jobs',
      'Redis queue dashboard',
    ],
  },
  '/features'
)

export default function FeaturesPage() {
  return (
    <LandingLayout>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            createBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Features', url: '/features' },
            ])
          ),
        }}
      />
      <div className="min-h-screen pt-32">
        <Features />
      </div>
    </LandingLayout>
  )
}
