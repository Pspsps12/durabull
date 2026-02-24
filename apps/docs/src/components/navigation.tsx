'use client'

import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { DurabullLogo, DurabullWordmark } from '@/components/durabull-logo'
import { WEB_APP_URL } from '@/lib/config'
import { cn } from '@/lib/utils'

const navLinks: { href: string; label: string }[] = [
  { href: '/#product', label: 'Product' },
  { href: '/#features', label: 'Capabilities' },
  { href: '/#faq', label: 'FAQ' },
]

// Track if the intro animation has already played this session
let hasAnimatedIn = false

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const shouldAnimate = useRef(!hasAnimatedIn)

  useEffect(() => {
    hasAnimatedIn = true
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.header
      initial={shouldAnimate.current ? { y: -100, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-colors duration-300',
        isScrolled || isMobileMenuOpen
          ? 'border-b border-border/70 bg-background/78 py-3 backdrop-blur-xl'
          : 'bg-transparent py-5'
      )}
    >
      <div className="container mx-auto px-6">
        <nav className="flex items-center justify-between gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5 group">
            <DurabullLogo className="h-6 w-6 text-emerald-500" />
            <DurabullWordmark className="h-4 text-foreground" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group relative text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-emerald-400 transition-[width] duration-200 group-hover:w-full" />
              </Link>
            ))}
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/documentation"
              className="whitespace-nowrap rounded-lg border border-emerald-300/35 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-100 transition-colors duration-200 hover:border-emerald-200/50 hover:bg-emerald-300/15 sm:px-4 sm:py-2 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Documentation
            </Link>
            <a
              href={`${WEB_APP_URL}/login`}
              className="whitespace-nowrap rounded-sm px-2 py-1 text-xs text-foreground/90 transition-colors duration-200 hover:text-foreground sm:text-sm max-[430px]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Log In
            </a>
            <a
              href={`${WEB_APP_URL}/signup`}
              className="group relative shrink-0 rounded-lg max-[430px]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="absolute inset-0 rounded-lg bg-emerald-400/25 opacity-0 blur-md transition-opacity duration-200 group-hover:opacity-100" />
              <div className="relative whitespace-nowrap rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition-colors duration-200 hover:bg-emerald-300 sm:px-4 sm:py-2 sm:text-sm">
                Sign Up
              </div>
            </a>
            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMobileMenuOpen}
              className="p-2 text-foreground/90 transition-colors duration-200 hover:text-foreground md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden mt-4 rounded-xl border border-border/80 bg-background/95 px-4 py-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-sm py-1 text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                <Link
                  href="/documentation"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-sm py-1 text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Documentation
                </Link>
                <a
                  href={`${WEB_APP_URL}/login`}
                  className="rounded-sm py-1 text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Log In
                </a>
                <a
                  href={`${WEB_APP_URL}/signup`}
                  className="w-full rounded-lg bg-emerald-400 py-2 text-center font-semibold text-emerald-950 transition-colors duration-200 hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Sign Up
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.header>
  )
}
