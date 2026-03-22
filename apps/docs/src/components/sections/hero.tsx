'use client'

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, BarChart3, BookOpen, Radar, ShieldCheck, Sparkles } from 'lucide-react'
import Image from 'next/image'
import { useRef } from 'react'
import { MAC_DOWNLOAD_URL, WEB_APP_URL } from '@/lib/config'

const trustSignals = [
  { icon: Radar, label: 'Live Queue Telemetry' },
  { icon: BarChart3, label: 'Fleet Analytics Insights' },
  { icon: ShieldCheck, label: 'Incident-Ready Visibility' },
  { icon: Sparkles, label: 'Self-Hosted or Managed Rollout' },
]

const floatingCards = [
  {
    title: 'Failure Replay',
    detail: 'Trace attempts instantly',
    className: '-left-4 top-[14%] 2xl:-left-14',
  },
  {
    title: 'Scheduled Control',
    detail: 'Cron health at a glance',
    className: 'right-2 top-[10%] 2xl:-right-10',
  },
  {
    title: 'Fleet Throughput',
    detail: 'System-wide trends in real time',
    className: 'left-[8%] bottom-[9%] 2xl:left-2',
  },
]

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })

  const showcaseY = useTransform(scrollYProgress, [0, 1], [0, shouldReduceMotion ? 0 : 85])
  const showcaseScale = useTransform(scrollYProgress, [0, 1], [1, shouldReduceMotion ? 1 : 0.96])
  const showcaseRotate = useTransform(scrollYProgress, [0, 1], [0, shouldReduceMotion ? 0 : -3])

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[min(100svh,68rem)] items-center overflow-hidden pt-24 pb-14 md:pt-28 md:pb-18 lg:pt-32 scroll-mt-24"
    >
      <div className="absolute inset-0 hero-grid opacity-45" aria-hidden="true" />
      <div className="absolute inset-0 hero-aurora" aria-hidden="true" />
      <div className="hero-orb hero-orb-primary" aria-hidden="true" />
      <div className="hero-orb hero-orb-secondary" aria-hidden="true" />

      <div className="container relative z-10 mx-auto w-full px-6">
        <div className="grid items-center gap-12 xl:grid-cols-12 xl:gap-10">
          <div className="xl:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-100/90 backdrop-blur-xl"
            >
              <span className="status-dot active" />
              Desktop apps now available
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="mt-6 max-w-[15ch] text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.7rem] lg:leading-[1.02]"
            >
              BullMQ operations with{' '}
              <span className="gradient-text">clarity, speed, and control.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16 }}
              className="mt-6 max-w-xl text-pretty text-base text-muted-foreground md:text-lg"
            >
              Durabull gives your team one clean command surface to inspect queues, recover failed
              jobs, and keep distributed workers healthy without digging through Redis internals.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <a
                href={`${WEB_APP_URL}/signup`}
                className="group inline-flex min-h-14 touch-manipulation items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-4 text-sm font-semibold text-emerald-950 shadow-[0_16px_42px_rgba(16,185,129,0.24)] transition-colors duration-200 hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start Free
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </a>
              <a
                href="/documentation"
                className="inline-flex min-h-14 touch-manipulation items-center justify-center gap-2 rounded-xl border border-border/80 bg-card/60 px-6 py-4 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Read Docs
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.28 }}
              className="mt-7 max-w-2xl"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/75">
                Also available on desktop
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {['Apple Silicon macOS', 'Windows', 'Homebrew'].map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-emerald-300/18 bg-emerald-300/8 px-3.5 py-1.5 text-xs font-medium text-emerald-100/85"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Need the desktop build? Download the current Apple Silicon macOS release or see
                install options for Windows and Homebrew in the
                <a
                  href="/documentation/getting-started/desktop-apps"
                  className="ml-1 text-emerald-200 transition-colors duration-200 hover:text-emerald-100"
                >
                  desktop apps guide
                </a>
                .
              </p>
              <a
                href={MAC_DOWNLOAD_URL}
                className="mt-4 inline-flex items-center text-sm font-medium text-emerald-200 transition-colors duration-200 hover:text-emerald-100"
              >
                Download the macOS app
              </a>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.36 }}
              className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2"
            >
              {trustSignals.map((signal) => (
                <li
                  key={signal.label}
                  className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card/45 px-3 py-2"
                >
                  <signal.icon className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  <span>{signal.label}</span>
                </li>
              ))}
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            style={{ y: showcaseY, scale: showcaseScale, rotateX: showcaseRotate }}
            className="relative mx-auto w-full max-w-5xl xl:col-span-7 transform-3d"
          >
            <div className="hero-showcase-glow" aria-hidden="true" />
            <div className="relative aspect-58/36">
              <div className="absolute left-0 top-0 z-10 w-[74%] -rotate-2">
                <div className="clean-screenshot-frame">
                  <div className="relative aspect-54/31">
                    <Image
                      src="/screenshots/fleet-analytics-throughput.png"
                      alt="Durabull Fleet Analytics throughput view showing processing velocity and trends across the worker fleet."
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 768px) 82vw, (max-width: 1536px) 42vw, 640px"
                    />
                  </div>
                </div>
              </div>

              <div className="absolute right-0 bottom-0 z-20 w-[82%] rotate-[1.4deg]">
                <div className="clean-screenshot-frame">
                  <div className="relative aspect-54/31">
                    <Image
                      src="/screenshots/fleet-analytics-dash.png"
                      alt="Durabull Fleet Analytics dashboard with fleet-wide queue health, throughput, and operational telemetry."
                      fill
                      className="object-cover object-top"
                      priority
                      sizes="(max-width: 768px) 100vw, (max-width: 1536px) 60vw, 900px"
                    />
                  </div>
                </div>
              </div>
            </div>

            {floatingCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 12 }}
                animate={
                  shouldReduceMotion
                    ? { opacity: 1, y: 0 }
                    : {
                        opacity: 1,
                        y: [0, -8, 0],
                      }
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0.35, delay: 0.12 * index }
                    : {
                        duration: 6.2 + index,
                        delay: 0.2 * index,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: 'easeInOut',
                      }
                }
                className={`absolute hidden rounded-xl border border-white/10 bg-[#070b14]/90 px-4 py-3 text-left shadow-[0_14px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl lg:block ${card.className}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-emerald-200/70">
                  {card.title}
                </p>
                <p className="mt-1 text-sm text-slate-300/90">{card.detail}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block"
      >
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <span>Scroll to explore</span>
          <motion.div
            animate={shouldReduceMotion ? undefined : { y: [0, 8, 0] }}
            transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY }}
            className="flex h-8 w-5 justify-center rounded-full border border-border/80 pt-1.5"
          >
            <div className="h-2 w-1 rounded-full bg-muted" />
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
