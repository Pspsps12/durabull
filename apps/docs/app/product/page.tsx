import type { Metadata } from 'next'
import { LandingLayout, Screenshots } from '@/components'
import { createMetadata } from '@/lib/seo'

export const metadata: Metadata = createMetadata(
  {
    title: 'Product',
    description:
      'See Durabull in action. A beautiful, intuitive dashboard for managing your BullMQ queues.',
    keywords: ['BullMQ dashboard', 'queue management', 'job monitoring', 'Redis dashboard'],
  },
  '/product'
)

export default function ProductPage() {
  return (
    <LandingLayout>
      <div className="min-h-screen pt-32">
        <Screenshots />
      </div>
    </LandingLayout>
  )
}
