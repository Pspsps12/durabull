'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { WEB_APP_URL } from '@/lib/config'

interface MarketingSection {
  title: string
  description: string
  items?: string[]
}

interface MarketingCta {
  label: string
  to: string
}

interface MarketingPageProps {
  badge?: string
  title: string
  subtitle: string
  sections: MarketingSection[]
  primaryCta?: MarketingCta
  secondaryCta?: MarketingCta
  footerNote?: ReactNode
}

function CtaLink({ to, label, primary = false }: { to: string; label: string; primary?: boolean }) {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-colors'
  const primaryClasses = 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
  const secondaryClasses = 'border border-border text-foreground hover:bg-accent'

  const content = (
    <>
      {label}
      {primary && <ArrowRight className="h-4 w-4" />}
    </>
  )

  // External links or mailto
  if (to.startsWith('http') || to.startsWith('mailto:')) {
    return (
      <a href={to} className={`${baseClasses} ${primary ? primaryClasses : secondaryClasses}`}>
        {content}
      </a>
    )
  }

  // Auth routes go to web app
  if (to === '/signup' || to === '/login') {
    return (
      <a
        href={`${WEB_APP_URL}${to}`}
        className={`${baseClasses} ${primary ? primaryClasses : secondaryClasses}`}
      >
        {content}
      </a>
    )
  }

  // Internal links
  return (
    <Link href={to} className={`${baseClasses} ${primary ? primaryClasses : secondaryClasses}`}>
      {content}
    </Link>
  )
}

export function MarketingPage({
  badge,
  title,
  subtitle,
  sections,
  primaryCta,
  secondaryCta,
  footerNote,
}: MarketingPageProps) {
  const columnsClass =
    sections.length >= 3
      ? 'md:grid-cols-3'
      : sections.length === 2
        ? 'md:grid-cols-2'
        : 'md:grid-cols-1'

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px]" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          {badge && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300 mb-8">
              {badge}
            </div>
          )}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            <span className="gradient-text">{title}</span>
          </h1>
          <p className="text-xl text-muted-foreground">{subtitle}</p>

          {(primaryCta || secondaryCta) && (
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              {primaryCta && <CtaLink to={primaryCta.to} label={primaryCta.label} primary />}
              {secondaryCta && <CtaLink to={secondaryCta.to} label={secondaryCta.label} />}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`grid gap-6 ${columnsClass}`}
        >
          {sections.map((section) => (
            <div key={section.title} className="p-6 border border-border bg-card/50 rounded-xl">
              <h3 className="font-semibold mb-2">{section.title}</h3>
              <p className="text-sm text-muted-foreground">{section.description}</p>
              {section.items && section.items.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </motion.div>

        {footerNote && (
          <div className="text-center mt-16 pt-8 border-t border-border text-sm text-muted-foreground">
            {footerNote}
          </div>
        )}
      </div>
    </div>
  )
}
