// frontend/src/features/landing/components/LandingOverview.tsx
import { motion } from 'framer-motion'
import { ScanLine, BellRing, Minus, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

function FeatureRow({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex gap-5 relative z-10 group"
    >
      <div
        className="w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors group-hover:text-white"
        style={{
          backgroundColor: 'white',
          borderColor: 'rgba(200,116,93,0.25)',
          color: 'var(--lp-brand)',
        }}
      >
        {icon}
      </div>
      <div>
        <h3
          className="text-lg font-semibold mb-0.5 transition-colors group-hover:text-[#C8745D]"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {title}
        </h3>
        <p className="text-base leading-relaxed" style={{ color: 'var(--lp-ink-muted)' }}>{desc}</p>
      </div>
    </motion.div>
  )
}

function LoopNode({ icon, label, position, delay }: { icon: ReactNode; label: string; position: string; delay: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 20 }}
      className={`absolute ${position} flex flex-col items-center gap-2.5 z-20 group`}
    >
      <div
        className="w-[72px] h-[72px] bg-white rounded-2xl shadow-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 rotate-3 group-hover:rotate-0"
        style={{ border: '1px solid var(--lp-surface-dark)', color: 'var(--lp-brand)' }}
      >
        {icon}
      </div>
      <div
        className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold shadow-sm uppercase tracking-wider"
        style={{ border: '1px solid var(--lp-surface-dark)', color: 'var(--lp-ink)' }}
      >
        {label}
      </div>
    </motion.div>
  )
}

export function LandingOverview() {
  return (
    <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
      <div
        className="rounded-[3rem] p-8 md:p-14 border overflow-hidden relative"
        style={{ backgroundColor: 'var(--lp-surface)', borderColor: 'var(--lp-surface-dark)' }}
      >
        <div className="grid lg:grid-cols-2 gap-14 items-center">

          {/* Left: text */}
          <div className="relative z-10">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold tracking-wider uppercase mb-8 border"
              style={{
                backgroundColor: 'var(--lp-brand-light)',
                color: 'var(--lp-brand)',
                borderColor: 'rgba(200,116,93,0.15)',
              }}
            >
              <RefreshCw size={15} className="animate-spin" style={{ animationDuration: '4s' }} />
              One continuous workflow
            </div>
            <h2
              className="text-4xl md:text-5xl mb-5 leading-tight"
              style={{ fontFamily: '"Playfair Display", Georgia, serif', color: 'var(--lp-brand)' }}
            >
              Three steps.<br />
              <span className="italic" style={{ color: 'var(--lp-ink)' }}>Zero waste.</span>
            </h2>
            <p className="text-lg leading-relaxed mb-10" style={{ color: 'var(--lp-ink-muted)' }}>
              Track every batch, monitor what expires first, consume with confidence. The loop closes itself.
            </p>

            <div className="flex flex-col gap-7 relative">
              <div className="absolute left-[1.05rem] top-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom, rgba(200,116,93,0.2), rgba(200,116,93,0.2), transparent)' }} />
              <FeatureRow icon={<ScanLine size={18} />} title="1. Track" desc="Add items via barcode, photo, or natural language. Every batch gets its own expiry and quantity." />
              <FeatureRow icon={<BellRing size={18} />} title="2. Monitor" desc="FEFO ordering surfaces what expires soonest. Get warned before anything goes bad." />
              <FeatureRow icon={<Minus size={18} />} title="3. Consume" desc="Tell the agent what you used. It cascades deductions across batches and updates your inventory." />
            </div>
          </div>

          {/* Right: loop diagram */}
          <div className="relative w-full max-w-[460px] aspect-square mx-auto flex items-center justify-center z-10">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 500">
              <circle cx="250" cy="250" r="170" fill="none" stroke="var(--lp-surface-dark)" strokeWidth="3" strokeDasharray="8 8" />
              <motion.circle
                cx="250" cy="250" r="170" fill="none"
                stroke="var(--lp-brand)" strokeWidth="5" strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 2.2, ease: 'easeInOut' }}
              />
              <motion.circle
                r="7" fill="var(--lp-brand)"
                initial={{ rotate: 0 }} animate={{ rotate: 360 }}
                transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                style={{ transformOrigin: '250px 250px' }}
                cx="250" cy="80"
              />
            </svg>

            <LoopNode icon={<ScanLine size={26} />} label="Track" position="top-[15%] left-[50%] -translate-x-1/2 -translate-y-1/2" delay={0.3} />
            <LoopNode icon={<BellRing size={26} />} label="Monitor" position="top-[67%] left-[80%] -translate-x-1/2 -translate-y-1/2" delay={0.7} />
            <LoopNode icon={<Minus size={26} />} label="Consume" position="top-[67%] left-[20%] -translate-x-1/2 -translate-y-1/2" delay={1.1} />

            {/* Center */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 1.4, type: 'spring' }}
              className="w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center shadow-lg z-20"
              style={{ border: '1px solid var(--lp-surface-dark)' }}
            >
              <RefreshCw size={22} className="mb-1.5 opacity-40" style={{ color: 'var(--lp-brand)' }} />
              <span
                className="font-bold text-base leading-tight uppercase tracking-widest text-center"
                style={{ fontFamily: '"Playfair Display", Georgia, serif', color: 'var(--lp-ink)' }}
              >
                The<br/>Loop
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
