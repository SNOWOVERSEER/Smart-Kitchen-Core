// frontend/src/features/landing/components/LandingHero.tsx
import { motion } from 'framer-motion'
import { ArrowUp, Package } from 'lucide-react'
import { AuthCard } from './AuthCard'

// Static animated chat demo - no real API calls
const MESSAGES = [
  { role: 'agent', text: 'You have A2 Milk and Baby Spinach expiring in 2 days. Use them first.' },
  { role: 'user',  text: 'I used 500ml of milk.' },
  { role: 'agent', text: 'Done. Batch #42 (A2 Milk, 2L) updated: 1.5L remaining.' },
  { role: 'agent', text: '3 items expiring this week. Want me to build a deduction plan?' },
]

function ChatBubble({ role, text }: { role: string; text: string }) {
  const isAgent = role === 'agent'
  return (
    <div className={`flex gap-2.5 ${isAgent ? 'items-start' : 'items-end justify-end'}`}>
      {isAgent && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
          style={{ backgroundColor: 'var(--lp-brand)' }}
        >
          KL
        </div>
      )}
      <div
        className="max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed"
        style={isAgent
          ? { backgroundColor: 'white', border: '1px solid var(--lp-surface-dark)', borderTopLeftRadius: 4, color: 'var(--lp-ink)' }
          : { backgroundColor: '#1A1A1A', color: 'white', borderTopRightRadius: 4 }
        }
      >
        {text}
      </div>
    </div>
  )
}

export function LandingHero() {
  return (
    <section className="pt-28 pb-20 px-6 max-w-7xl mx-auto min-h-screen flex flex-col justify-center">
      <div className="grid lg:grid-cols-2 gap-12 xl:gap-20 items-center">

        {/* Left: Copy + Auth */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-7"
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider w-fit border"
            style={{ backgroundColor: 'var(--lp-brand-light)', color: 'var(--lp-brand)', borderColor: 'var(--lp-brand-light)' }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--lp-brand)' }} />
            FEFO-First Inventory
          </div>

          {/* Heading */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl leading-[0.95] tracking-tight"
            style={{ fontFamily: '"Playfair Display", Georgia, serif', color: 'var(--lp-brand)' }}
          >
            Know what's in<br />
            <span className="italic" style={{ opacity: 0.75 }}>your kitchen.</span>
          </h1>

          <p className="text-lg md:text-xl leading-relaxed max-w-md" style={{ color: 'var(--lp-ink-muted)' }}>
            Batch-level tracking that tells you what to use first. Nothing expires. Nothing is wasted.
          </p>

          <AuthCard />
        </motion.div>

        {/* Right: Product demo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="relative hidden lg:block"
        >
          {/* Browser chrome card */}
          <div
            className="rounded-[2rem] p-5 shadow-xl border"
            style={{ backgroundColor: 'var(--lp-surface)', borderColor: 'var(--lp-surface-dark)' }}
          >
            {/* Chrome bar */}
            <div className="flex items-center gap-1.5 mb-5 px-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <div className="ml-3 flex-1 h-5 rounded bg-white/60 flex items-center px-2.5">
                <span className="text-[10px] font-mono" style={{ color: 'var(--lp-ink-muted)' }}>
                  app.kitchenloop.ai/chat
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex flex-col gap-3 mb-4">
              {MESSAGES.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.3 }}
                >
                  <ChatBubble role={m.role} text={m.text} />
                </motion.div>
              ))}
            </div>

            {/* Input bar */}
            <div
              className="flex items-center justify-between px-4 py-2.5 rounded-2xl border shadow-sm"
              style={{ backgroundColor: 'white', borderColor: 'var(--lp-surface-dark)' }}
            >
              <span className="text-sm" style={{ color: 'var(--lp-ink-muted)' }}>Ask the agent...</span>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: 'var(--lp-ink)' }}
              >
                <ArrowUp size={14} />
              </div>
            </div>
          </div>

          {/* Floating badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 1.8, type: 'spring' }}
            className="absolute -top-4 -right-4 flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-lg border"
            style={{ backgroundColor: 'white', borderColor: 'var(--lp-surface-dark)' }}
          >
            <Package size={14} style={{ color: 'var(--lp-brand)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--lp-ink)' }}>A2 Milk · 7d left</span>
          </motion.div>

          {/* Glow */}
          <div
            className="absolute -z-10 top-12 -right-12 w-56 h-56 rounded-full blur-3xl opacity-30"
            style={{ backgroundColor: 'var(--lp-brand)' }}
          />
        </motion.div>
      </div>
    </section>
  )
}
