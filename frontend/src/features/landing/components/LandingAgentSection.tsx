// frontend/src/features/landing/components/LandingAgentSection.tsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, BotMessageSquare, Clock, Search, Minus } from 'lucide-react'

const SCENARIOS = [
  {
    icon: Search,
    label: 'Query inventory',
    messages: [
      { role: 'user',  text: "What's expiring this week?" },
      { role: 'agent', text: "3 items need attention:\n• Baby Spinach (200g) — 2 days\n• A2 Milk (1.5L) — 4 days\n• Chicken Breast (600g) — 3 days\n\nConsume in this order for zero waste." },
    ],
  },
  {
    icon: Minus,
    label: 'Consume item',
    messages: [
      { role: 'user',  text: 'I used 500ml of milk' },
      { role: 'agent', text: 'Preview: deduct 500ml from Batch #42 (A2 Milk, Fridge).\n\nBefore: 1.5L → After: 1.0L\n\nConfirm?' },
      { role: 'user',  text: 'Yes' },
      { role: 'agent', text: 'Done. Batch #42 updated. 1.0L remaining.' },
    ],
  },
  {
    icon: Clock,
    label: 'Add item',
    messages: [
      { role: 'user',  text: 'Add 6 eggs to fridge, expires March 10' },
      { role: 'agent', text: 'Added: 6 pcs Free Range Eggs, Fridge, expires Mar 10. Batch #44 created.' },
    ],
  },
]

export function LandingAgentSection() {
  const [scenario, setScenario] = useState(0)
  const [visibleCount, setVisibleCount] = useState(1)

  // Auto-advance
  useEffect(() => {
    const msgs = SCENARIOS[scenario].messages.length
    if (visibleCount < msgs) {
      const t = setTimeout(() => setVisibleCount((c) => c + 1), 1200)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => {
        const next = (scenario + 1) % SCENARIOS.length
        setScenario(next)
        setVisibleCount(1)
      }, 2800)
      return () => clearTimeout(t)
    }
  }, [scenario, visibleCount])

  const current = SCENARIOS[scenario]
  const messages = current.messages.slice(0, visibleCount)

  return (
    <section
      className="py-24 px-6 max-w-7xl mx-auto relative z-30 rounded-t-[3rem] lg:rounded-t-[4rem] -mt-12 shadow-[0_-30px_60px_rgba(0,0,0,0.1)]"
      style={{ backgroundColor: 'var(--lp-bg)' }}
    >
      <div className="grid lg:grid-cols-2 gap-16 items-center">

        {/* Left: copy */}
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider w-fit border mb-8"
            style={{ backgroundColor: 'var(--lp-brand-light)', color: 'var(--lp-brand)', borderColor: 'rgba(200,116,93,0.15)' }}
          >
            <BotMessageSquare size={13} /> AI Agent
          </div>
          <h2
            className="text-4xl md:text-5xl mb-5 leading-tight"
            style={{ fontFamily: '"Playfair Display", Georgia, serif', color: 'var(--lp-brand)' }}
          >
            Just say it.<br />
            <span className="italic" style={{ color: 'var(--lp-ink)' }}>It handles the rest.</span>
          </h2>
          <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--lp-ink-muted)' }}>
            Natural language in English or Chinese. The agent searches your inventory, shows you a preview, and executes only after you confirm.
          </p>

          {/* Scenario tabs */}
          <div className="flex flex-col gap-3">
            {SCENARIOS.map((s, i) => {
              const Icon = s.icon
              const active = i === scenario
              return (
                <button
                  key={i}
                  onClick={() => { setScenario(i); setVisibleCount(1) }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                  style={{
                    backgroundColor: active ? 'var(--lp-surface)' : 'transparent',
                    border: `1px solid ${active ? 'var(--lp-surface-dark)' : 'transparent'}`,
                    color: active ? 'var(--lp-ink)' : 'var(--lp-ink-muted)',
                  }}
                >
                  <Icon size={16} />
                  <span className="text-sm font-medium">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: chat demo */}
        <div
          className="rounded-[2rem] p-5 shadow-lg border"
          style={{ backgroundColor: 'var(--lp-surface)', borderColor: 'var(--lp-surface-dark)' }}
        >
          {/* Chrome */}
          <div className="flex items-center gap-1.5 mb-4 px-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <div className="ml-3 flex-1 h-5 rounded bg-white/60 flex items-center px-2.5">
              <span className="text-[10px] font-mono" style={{ color: 'var(--lp-ink-muted)' }}>Kitchen Loop Agent</span>
            </div>
          </div>

          {/* Messages */}
          <div className="min-h-[220px] flex flex-col gap-3 mb-4">
            <AnimatePresence mode="wait">
              {messages.map((m, i) => {
                const isAgent = m.role === 'agent'
                return (
                  <motion.div
                    key={`${scenario}-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2.5 ${isAgent ? 'items-start' : 'items-end justify-end'}`}
                  >
                    {isAgent && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 mt-0.5"
                        style={{ backgroundColor: 'var(--lp-brand)' }}
                      >KL</div>
                    )}
                    <div
                      className="max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-line"
                      style={isAgent
                        ? { backgroundColor: 'white', border: '1px solid var(--lp-surface-dark)', borderTopLeftRadius: 4, color: 'var(--lp-ink)' }
                        : { backgroundColor: '#1A1A1A', color: 'white', borderTopRightRadius: 4 }
                      }
                    >
                      {m.text}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          {/* Input bar */}
          <div
            className="flex items-center justify-between px-4 py-2.5 rounded-2xl border shadow-sm"
            style={{ backgroundColor: 'white', borderColor: 'var(--lp-surface-dark)' }}
          >
            <span className="text-sm" style={{ color: 'var(--lp-ink-muted)' }}>Message the agent...</span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: 'var(--lp-ink)' }}>
              <ArrowUp size={14} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
