// frontend/src/features/landing/components/LandingPricing.tsx
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

function Feature({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Check size={18} className={`shrink-0 mt-0.5 ${light ? 'text-white/70' : ''}`} style={light ? {} : { color: 'var(--lp-brand)' }} />
      <span className={light ? 'text-white/85' : ''} style={light ? {} : { color: 'var(--lp-ink-muted)' }}>{text}</span>
    </div>
  )
}

export function LandingPricing() {
  const scrollToAuth = () => document.getElementById('hero-auth')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <section
      id="plans"
      className="pt-20 pb-32 px-6 max-w-7xl mx-auto border-t"
      style={{ borderColor: 'var(--lp-surface-dark)' }}
    >
      <div className="text-center mb-14">
        <h2
          className="text-4xl md:text-5xl mb-5"
          style={{ fontFamily: '"Playfair Display", Georgia, serif', color: 'var(--lp-brand)' }}
        >
          Simple pricing for smarter kitchens
        </h2>
        <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--lp-ink-muted)' }}>
          Start free with your own API key. Upgrade when you want built-in AI.
        </p>
        <div
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border"
          style={{ backgroundColor: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Built-in AI is free for your first 30 days
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-[2rem] p-8 shadow-sm border flex flex-col"
          style={{ backgroundColor: 'white', borderColor: 'var(--lp-surface-dark)' }}
        >
          <h3 className="text-2xl mb-2" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>Free + BYO AI</h3>
          <div className="text-4xl font-bold mb-6" style={{ color: 'var(--lp-ink)' }}>
            $0<span className="text-lg font-normal" style={{ color: 'var(--lp-ink-muted)' }}>/month</span>
          </div>
          <div className="flex flex-col gap-3.5 mb-8 flex-1">
            <Feature text="Batch-level inventory tracking" />
            <Feature text="FEFO expiry ordering" />
            <Feature text="Bring your own OpenAI or Anthropic key" />
            <Feature text="Barcode + photo recognition" />
          </div>
          <button
            onClick={scrollToAuth}
            className="w-full py-4 rounded-xl font-medium border-2 transition-colors"
            style={{ borderColor: 'var(--lp-surface-dark)', color: 'var(--lp-ink)' }}
          >
            Start free
          </button>
          <p className="text-xs text-center mt-3" style={{ color: 'var(--lp-ink-muted)' }}>
            Continue with your own key after 30 days.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="rounded-[2rem] p-8 shadow-xl relative overflow-hidden flex flex-col"
          style={{ backgroundColor: 'var(--lp-brand)', color: 'white' }}
        >
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <h3 className="text-2xl mb-2 relative z-10" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            Kitchen Loop Member
          </h3>
          <div className="text-4xl font-bold mb-6 relative z-10">
            $5<span className="text-lg font-normal text-white/65">/month</span>
          </div>
          <div className="flex flex-col gap-3.5 mb-8 flex-1 relative z-10">
            <Feature text="Everything in Free" light />
            <Feature text="Built-in AI quota included" light />
            <Feature text="Stronger reasoning models" light />
            <Feature text="Priority new features" light />
          </div>
          <button
            onClick={scrollToAuth}
            className="w-full py-4 rounded-xl font-medium relative z-10 transition-colors"
            style={{ backgroundColor: 'white', color: 'var(--lp-brand)' }}
          >
            Upgrade to Member
          </button>
          <p className="text-xs text-center mt-3 text-white/60 relative z-10">
            No API keys needed. Just sign in and go.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
