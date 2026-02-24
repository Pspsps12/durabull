import type { Metadata } from 'next'
import { LandingLayout, MarketingPage } from '@/components'
import { createMetadata } from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'Terms of Service',
    description: 'Simple guidelines for using Durabull responsibly during the beta.',
    keywords: ['Durabull terms', 'terms of service', 'usage guidelines'],
  },
  '/terms'
)

export default function TermsPage() {
  return (
    <LandingLayout>
      <MarketingPage
        badge="Terms"
        title="Terms of Service"
        subtitle="Simple guidelines for using Durabull responsibly during the beta."
        primaryCta={{ label: 'Contact Us', to: '/contact' }}
        sections={[
          {
            title: 'Using the Service',
            description: 'Keep your credentials safe and use the platform responsibly.',
            items: [
              'Protect your login details',
              'Follow BullMQ best practices',
              'Respect rate limits',
            ],
          },
          {
            title: 'Account Responsibilities',
            description: 'You are responsible for your data and usage.',
            items: [
              'Maintain accurate account info',
              'Review access permissions',
              'Notify us of issues',
            ],
          },
          {
            title: 'Fair Usage',
            description: 'We reserve the right to ensure the service remains stable for all users.',
            items: [
              'Avoid abusive traffic',
              'Report incidents promptly',
              'Work with us on scale needs',
            ],
          },
        ]}
        footerNote="Terms will evolve as Durabull matures. Reach out with questions."
      />
    </LandingLayout>
  )
}
