import type { Metadata } from 'next'
import { FAQ, LandingLayout } from '@/components'
import { faqs } from '@/lib/faqs'
import { createBreadcrumbSchema, createFAQSchema, createMetadata } from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'FAQ',
    description:
      'Frequently asked questions about Durabull. Learn about BullMQ dashboard features, pricing, security, authless mode, and persistence options.',
    keywords: [
      'BullMQ FAQ',
      'Durabull questions',
      'queue monitoring help',
      'BullMQ dashboard support',
    ],
  },
  '/faq'
)

export default function FAQPage() {
  return (
    <LandingLayout>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for JSON-LD
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            createFAQSchema(faqs),
            createBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'FAQ', url: '/faq' },
            ]),
          ]),
        }}
      />
      <div className="min-h-screen pt-32">
        <FAQ />
      </div>
    </LandingLayout>
  )
}
