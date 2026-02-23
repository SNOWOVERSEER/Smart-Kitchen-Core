// frontend/src/features/landing/components/LandingNavbar.tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'

export function LandingNavbar() {
  const [open, setOpen] = useState(false)

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setOpen(false)
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b"
      style={{
        backgroundColor: 'rgba(253,252,248,0.85)',
        backdropFilter: 'blur(12px)',
        borderColor: 'var(--lp-surface-dark)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: 'var(--lp-brand)' }}
          >
            KL
          </div>
          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
          >
            Kitchen Loop
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {(['features', 'plans'] as const).map((id) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="text-sm font-medium capitalize transition-colors"
              style={{ color: 'var(--lp-ink-muted)' }}
            >
              {id === 'plans' ? 'Pricing' : 'Features'}
            </button>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => scrollTo('hero-auth')}
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--lp-ink)' }}
          >
            Sign in
          </button>
          <button
            onClick={() => scrollTo('hero-auth')}
            className="px-5 py-2.5 text-sm font-medium rounded-full text-white transition-colors shadow-sm"
            style={{ backgroundColor: 'var(--lp-brand)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--lp-brand-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--lp-brand)' }}
          >
            Get started
          </button>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="md:hidden absolute top-20 left-0 right-0 border-b p-6 flex flex-col gap-4 shadow-lg"
            style={{ backgroundColor: 'var(--lp-bg)', borderColor: 'var(--lp-surface-dark)' }}
          >
            <button className="text-left text-lg font-medium" onClick={() => scrollTo('features')}>Features</button>
            <button className="text-left text-lg font-medium" onClick={() => scrollTo('plans')}>Pricing</button>
            <hr style={{ borderColor: 'var(--lp-surface-dark)' }} />
            <button className="text-left text-lg font-medium" onClick={() => scrollTo('hero-auth')}>Sign in</button>
            <button
              className="text-white py-3 rounded-xl font-medium text-center"
              style={{ backgroundColor: 'var(--lp-brand)' }}
              onClick={() => scrollTo('hero-auth')}
            >
              Get started
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
