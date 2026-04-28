import type { Metadata } from 'next'
import { LandingLayout, MarketingPage } from '@/components'
import { createMetadata } from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'Privacy Policy',
    description: 'A clear summary of how we handle data while Durabull is in beta.',
    keywords: ['Durabull privacy', 'privacy policy', 'data handling'],
  },
  '/privacy'
)

export default function PrivacyPage() {
  return (
    <LandingLayout>
      <MarketingPage
        badge="Privacy"
        title="Privacy Policy"
        subtitle="A clear summary of how we handle data while Durabull is in beta."
        primaryCta={{ label: 'Contact Us', to: '/contact' }}
        sections={[
          {
            title: 'Data We Collect',
            description: 'We only collect what is needed to operate the product.',
            items: [
              'Account details and authentication',
              'Queue metadata and metrics',
              'Anonymous/pseudonymous usage telemetry',
            ],
          },
          {
            title: 'Anonymous Telemetry',
            description:
              'Production and self-hosted Durabull usage automatically sends product telemetry that helps us improve the product.',
            items: [
              'Feature and route usage',
              'Safe runtime context and aggregate counts',
              'No Redis URLs, queue names, Redis key names, job data, logs, emails, names, organizations, or raw error messages',
            ],
          },
          {
            title: 'How We Use Data',
            description: 'We use data to operate, improve, and secure Durabull.',
            items: [
              'Deliver the dashboard experience',
              'Improve reliability and performance',
              'Prevent abuse',
            ],
          },
          {
            title: 'Your Choices',
            description: 'You control your data and can request changes anytime.',
            items: ['Export or delete data', 'Update permissions', 'Opt out of marketing'],
          },
        ]}
        footerNote="This summary is for convenience and will be expanded into a full policy."
      />
    </LandingLayout>
  )
}
