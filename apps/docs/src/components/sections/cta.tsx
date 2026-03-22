'use client'

import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Download } from 'lucide-react'
import { MAC_DOWNLOAD_URL, WEB_APP_URL } from '@/lib/config'

const benefits = [
  'Cloud access available',
  'Native apps for Apple Silicon macOS and Windows',
  'Homebrew rollout for Apple Silicon Mac teams',
  'Self-hosted docs included',
]

export function CTA() {
  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-linear-to-b from-background via-emerald-950/10 to-background" />
      <div className="absolute top-0 left-0 h-px w-full bg-linear-to-r from-transparent via-emerald-500/50 to-transparent" />
      <div className="absolute bottom-0 left-0 h-px w-full bg-linear-to-r from-transparent via-emerald-500/50 to-transparent" />

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px]" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Built by engineers, for the BullMQ community
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Ready to roll out
            <br />
            <span className="gradient-text">Durabull your way?</span>
          </motion.h2>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Choose the path that fits your team: start in the hosted product, install the native
            desktop app, or move into the docs for self-hosting and operational guidance.
          </motion.p>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4 mb-10"
          >
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>{benefit}</span>
              </div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a href={`${WEB_APP_URL}/signup`} className="group inline-flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-lg bg-emerald-500/30 blur-xl transition-colors group-hover:bg-emerald-500/40" />
                <div className="relative flex items-center gap-2 rounded-lg bg-emerald-500 px-8 py-4 text-lg font-semibold text-emerald-950 transition-colors hover:bg-emerald-400">
                  Start Free
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </a>
            <a
              href={MAC_DOWNLOAD_URL}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-8 py-4 text-lg font-semibold text-emerald-50 transition-colors hover:bg-emerald-300/15"
            >
              Download for macOS
              <Download className="h-5 w-5" />
            </a>
            <a
              href="/documentation/getting-started/desktop-apps"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-8 py-4 text-lg font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Desktop Install Guide
              <ArrowRight className="h-5 w-5" />
            </a>
          </motion.div>

          {/* Community message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-12 pt-8 border-t border-border"
          >
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Built by engineers who wanted a more trustworthy BullMQ operations surface, with a
              desktop footprint that is easy to install and simple to standardize.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
