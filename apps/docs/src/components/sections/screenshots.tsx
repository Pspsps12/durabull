'use client'

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Layers,
  List,
  ScrollText,
  TrendingUp,
} from 'lucide-react'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const screenshots = [
  {
    id: 'queues',
    title: 'Queue Overview',
    description: 'See queue pressure, throughput, and bottlenecks instantly.',
    detail: 'High-signal status across every queue and connection.',
    icon: Layers,
    image: '/screenshots/queues.png',
  },
  {
    id: 'scheduled',
    title: 'Scheduled Jobs',
    description: 'Control cron schedules with confidence and clear next-run context.',
    detail: 'Keep recurring workloads predictable in every environment.',
    icon: Calendar,
    image: '/screenshots/scheduled.png',
  },
  {
    id: 'failed',
    title: 'Failure Debugging',
    description: 'Jump from failure alerts to root cause with full attempt history.',
    detail: 'Speed up incident response with less operational guesswork.',
    icon: AlertTriangle,
    image: '/screenshots/failed.png',
  },
  {
    id: 'jobs',
    title: 'Job Inspection',
    description: 'Inspect payloads, options, progress, and return values in one flow.',
    detail: 'Understand job behavior before shipping queue-side fixes.',
    icon: List,
    image: '/screenshots/jobs.png',
  },
  {
    id: 'logs',
    title: 'Live Logs',
    description: 'Track execution logs alongside queue state while jobs run.',
    detail: 'Pinpoint anomalies without opening multiple tools.',
    icon: ScrollText,
    image: '/screenshots/logging.png',
  },
  {
    id: 'fleet-analytics-dash',
    title: 'Fleet Analytics Overview',
    description: 'Monitor aggregate queue health and fleet-level workload behavior in one view.',
    detail: 'Turn cross-queue telemetry into actionable operations decisions.',
    icon: BarChart3,
    image: '/screenshots/fleet-analytics-dash.png',
  },
  {
    id: 'fleet-analytics-throughput',
    title: 'Fleet Throughput Trends',
    description: 'Track throughput and processing velocity over time across your worker fleet.',
    detail: 'Spot rising pressure early before queue latency turns into incidents.',
    icon: TrendingUp,
    image: '/screenshots/fleet-analytics-throughput.png',
  },
]

export function Screenshots() {
  const [activeTab, setActiveTab] = useState(screenshots[0].id)
  const shouldReduceMotion = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })

  const previewY = useTransform(
    scrollYProgress,
    [0, 1],
    [shouldReduceMotion ? 0 : 40, shouldReduceMotion ? 0 : -30]
  )
  const previewScale = useTransform(scrollYProgress, [0, 1], [1, shouldReduceMotion ? 1 : 0.96])

  useEffect(() => {
    if (shouldReduceMotion) {
      return
    }

    const interval = window.setInterval(() => {
      setActiveTab((current) => {
        const currentIndex = screenshots.findIndex((item) => item.id === current)
        const nextIndex = currentIndex === screenshots.length - 1 ? 0 : currentIndex + 1
        return screenshots[nextIndex].id
      })
    }, 5400)

    return () => window.clearInterval(interval)
  }, [shouldReduceMotion])

  const activeScreenshot =
    screenshots.find((screenshot) => screenshot.id === activeTab) ?? screenshots[0]

  return (
    <section ref={sectionRef} id="product" className="relative overflow-hidden py-32 scroll-mt-24">
      <div className="absolute inset-0 bg-grid opacity-25" aria-hidden="true" />
      <div className="absolute inset-0 hero-aurora opacity-45" aria-hidden="true" />

      <div className="container relative z-10 mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-emerald-200/80">
            Product Tour
          </span>
          <h2 className="mt-6 text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            One interface for your queue lifecycle and fleet analytics.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            From triaging failed jobs to validating scheduled workloads, Durabull keeps every
            operational path visible, fast, and deeply inspectable, including fleet-wide throughput
            intelligence.
          </p>
        </motion.div>

        <div className="mt-16 grid items-start gap-10 lg:grid-cols-[minmax(0,370px)_minmax(0,1fr)]">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45 }}
            className="space-y-3 lg:sticky lg:top-28"
          >
            {screenshots.map((screenshot, index) => (
              <button
                type="button"
                key={screenshot.id}
                onClick={() => setActiveTab(screenshot.id)}
                className={cn(
                  'w-full rounded-2xl border p-5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  activeTab === screenshot.id
                    ? 'border-emerald-300/35 bg-emerald-300/10'
                    : 'border-border/80 bg-card/45 hover:border-emerald-300/25 hover:bg-card/65'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'inline-flex rounded-lg border p-2',
                      activeTab === screenshot.id
                        ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
                        : 'border-border/80 bg-secondary/50 text-muted-foreground'
                    )}
                  >
                    <screenshot.icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-200/70">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h3 className="text-base font-semibold text-foreground">
                        {screenshot.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{screenshot.description}</p>
                  </div>
                </div>
              </button>
            ))}
            <p className="pl-1 text-xs text-muted-foreground">
              The tour auto-advances to showcase core surfaces.
            </p>
          </motion.div>

          <motion.div style={{ y: previewY, scale: previewScale }} className="relative">
            <div
              className="pointer-events-none absolute -inset-8 rounded-[32px] bg-[radial-gradient(80%_80%_at_50%_40%,rgba(34,197,94,0.2)_0%,rgba(6,9,15,0)_75%)]"
              aria-hidden="true"
            />
            <div className="clean-screenshot-frame">
              <div className="relative aspect-[54/31] bg-[#070b15]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeScreenshot.id}
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.985 }}
                    transition={{ duration: shouldReduceMotion ? 0.15 : 0.35 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={activeScreenshot.image}
                      alt={`${activeScreenshot.title} view from the Durabull dashboard`}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 1024px) 100vw, 72vw"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeScreenshot.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="mt-5 rounded-xl border border-border/70 bg-card/55 p-4"
              >
                <h3 className="text-lg font-semibold text-foreground">{activeScreenshot.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{activeScreenshot.detail}</p>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
