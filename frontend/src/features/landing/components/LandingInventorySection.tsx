import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Package, Milk, Leaf } from 'lucide-react'

export function LandingInventorySection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 25, restDelta: 0.001 })

  // Text opacities
  const t1Op = useTransform(smooth, [0, 0.15, 0.25, 0.30], [0, 1, 1, 0])
  const t2Op = useTransform(smooth, [0.30, 0.45, 0.55, 0.60], [0, 1, 1, 0])
  const t3Op = useTransform(smooth, [0.60, 0.75, 0.90, 1.0], [0, 1, 1, 1])

  // Phase 1: Chat card
  const chatY  = useTransform(smooth, [0, 0.15, 0.25], ['100%', '0%', '-25%'])
  const chatOp = useTransform(smooth, [0, 0.10, 0.20, 0.28], [0, 1, 1, 0])

  // Phase 2: Floating batch cards
  const cardsScale = useTransform(smooth, [0.22, 0.32], [0.5, 1])
  const cardsOp    = useTransform(smooth, [0.22, 0.32, 0.80, 0.90], [0, 1, 1, 0])
  const c1X = useTransform(smooth, [0.22, 0.32, 0.42, 0.52], [0, -130, -130, 0])
  const c1Y = useTransform(smooth, [0.22, 0.32, 0.42, 0.52], [0,  -90,  -90, -50])
  const c1Scale = useTransform(smooth, [0.42, 0.52, 0.72, 0.82], [1, 1.15, 1.15, 0.9])
  const c2X = useTransform(smooth, [0.22, 0.32, 0.42, 0.52], [0, 130, 130, 160])
  const c2Y = useTransform(smooth, [0.22, 0.32, 0.42, 0.52], [0, -45, -45, 110])
  const c2Op = useTransform(smooth, [0.42, 0.52], [1, 0.2])
  const c3X = useTransform(smooth, [0.22, 0.32, 0.42, 0.52], [0, 0, 0, -160])
  const c3Y = useTransform(smooth, [0.22, 0.32, 0.42, 0.52], [0, 110, 110, 110])
  const c3Op = useTransform(smooth, [0.42, 0.52], [1, 0.2])

  // Warning state transitions on card 1
  const warningOp = useTransform(smooth, [0.47, 0.57], [0, 1])
  const normalOp  = useTransform(smooth, [0.47, 0.57], [1, 0])

  // Phase 3: Consume confirm
  const confirmY  = useTransform(smooth, [0.67, 0.77], ['100%', '18%'])
  const confirmOp = useTransform(smooth, [0.67, 0.77], [0, 1])
  const checkOp    = useTransform(smooth, [0.77, 0.83], [0, 1])
  const checkScale = useTransform(smooth, [0.77, 0.83], [0, 1])

  // Background glow
  const bgGlow = useTransform(
    smooth,
    [0, 0.5, 1],
    [
      'radial-gradient(circle at 50% 50%, rgba(200,116,93,0.18) 0%, transparent 55%)',
      'radial-gradient(circle at 50% 50%, rgba(245,158,11,0.18) 0%, transparent 55%)',
      'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.18) 0%, transparent 55%)',
    ]
  )

  const cardBase = 'absolute backdrop-blur-2xl border rounded-[2rem] shadow-2xl'
  const cardDark = 'bg-white/10 border-white/20'

  return (
    <section ref={containerRef} className="h-[400vh] relative z-20 -mt-12">
      <div className="sticky top-0 h-screen overflow-hidden flex items-center justify-center bg-[#050505] rounded-t-[3rem] lg:rounded-t-[4rem] shadow-[0_-30px_60px_rgba(0,0,0,0.2)]">

        <motion.div className="absolute inset-0" style={{ background: bgGlow }} />

        {/* Text overlays */}
        <div className="absolute inset-0 z-50 pointer-events-none">

          {/* Phase 1 */}
          <motion.div style={{ opacity: t1Op }} className="absolute top-1/2 -translate-y-1/2 left-8 md:left-16">
            <div className="text-[#C8745D] font-mono text-sm tracking-widest uppercase mb-5 flex items-center gap-3">
              <span className="w-7 h-px bg-[#C8745D]" /> Phase 01 / Add
            </div>
            <h2
              className="text-5xl md:text-7xl leading-[0.92] tracking-tight mb-5 text-white"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Say it.<br /><span className="italic opacity-40">It&apos;s logged.</span>
            </h2>
            <p className="text-white/60 text-lg max-w-sm">
              Tell the agent what you bought. It adds the batch with expiry, brand, and location — no forms.
            </p>
          </motion.div>

          {/* Phase 2 */}
          <motion.div style={{ opacity: t2Op }} className="absolute top-1/2 -translate-y-1/2 left-8 md:left-16">
            <div className="text-amber-500 font-mono text-sm tracking-widest uppercase mb-5 flex items-center gap-3">
              <span className="w-7 h-px bg-amber-500" /> Phase 02 / Monitor
            </div>
            <h2
              className="text-5xl md:text-7xl leading-[0.92] tracking-tight mb-5 text-white"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Spot what<br /><span className="italic opacity-40">expires first.</span>
            </h2>
            <p className="text-white/60 text-lg max-w-sm">
              FEFO ordering surfaces the soonest-expiring batch automatically. Nothing slips through.
            </p>
          </motion.div>

          {/* Phase 3 */}
          <motion.div style={{ opacity: t3Op }} className="absolute top-1/2 -translate-y-1/2 left-8 md:left-16">
            <div className="text-emerald-500 font-mono text-sm tracking-widest uppercase mb-5 flex items-center gap-3">
              <span className="w-7 h-px bg-emerald-500" /> Phase 03 / Consume
            </div>
            <h2
              className="text-5xl md:text-7xl leading-[0.92] tracking-tight mb-5 text-white"
              style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
            >
              Use it.<br /><span className="italic opacity-40">Auto-synced.</span>
            </h2>
            <p className="text-white/60 text-lg max-w-sm">
              &quot;I used 500ml of milk.&quot; Done. Batch #42 updated, cascade deduction applied.
            </p>
          </motion.div>
        </div>

        {/* Visuals stage */}
        <div className="relative w-full max-w-5xl aspect-square flex items-center justify-center z-10 md:translate-x-1/4">

          {/* Phase 1: Chat card */}
          <motion.div
            style={{ y: chatY, opacity: chatOp }}
            className="absolute w-80 bg-[#111] rounded-[1.5rem] p-5 shadow-2xl border border-white/10"
          >
            <div className="text-xs text-white/40 mb-3 font-mono">Kitchen Loop Agent</div>
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="text-white/80 bg-white/10 rounded-xl rounded-tl-sm px-3.5 py-2.5 w-fit">
                Add 2L A2 Milk to fridge, expires Feb 28
              </div>
              <div className="text-white/80 self-end bg-[#C8745D]/30 border border-[#C8745D]/40 rounded-xl rounded-tr-sm px-3.5 py-2.5">
                Done. Batch #43 added — 2L A2 Milk, Fridge, expires Feb 28.
              </div>
            </div>
          </motion.div>

          {/* Phase 2 & 3: Floating batch cards */}
          <motion.div style={{ scale: cardsScale, opacity: cardsOp }} className="absolute inset-0 flex items-center justify-center">

            {/* Card: Greek Yogurt */}
            <motion.div style={{ x: c2X, y: c2Y, opacity: c2Op }} className={`${cardBase} ${cardDark} w-64 p-4`}>
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Package size={22} className="text-white/70" />
                </div>
                <div>
                  <div className="font-semibold text-white">Greek Yogurt</div>
                  <div className="text-xs text-white/55 mt-0.5">500g · 5 days left</div>
                </div>
              </div>
            </motion.div>

            {/* Card: Chicken */}
            <motion.div style={{ x: c3X, y: c3Y, opacity: c3Op }} className={`${cardBase} ${cardDark} w-64 p-4`}>
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Package size={22} className="text-white/70" />
                </div>
                <div>
                  <div className="font-semibold text-white">Chicken Breast</div>
                  <div className="text-xs text-white/55 mt-0.5">600g · 3 days left</div>
                </div>
              </div>
            </motion.div>

            {/* Card: Spinach (hero — transitions from normal to warning) */}
            <motion.div style={{ x: c1X, y: c1Y, scale: c1Scale, zIndex: 50 }} className="absolute w-72 h-24">
              {/* Normal */}
              <motion.div style={{ opacity: normalOp }} className={`${cardBase} ${cardDark} absolute inset-0 p-4 flex items-center gap-4`}>
                <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Leaf size={24} className="text-white/70" />
                </div>
                <div>
                  <div className="font-semibold text-lg text-white">Baby Spinach</div>
                  <div className="text-sm text-white/55">200g · 5 days left</div>
                </div>
              </motion.div>

              {/* Warning */}
              <motion.div
                style={{ opacity: warningOp }}
                className={`${cardBase} absolute inset-0 bg-amber-500/20 border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.3)] p-4 flex items-center gap-4`}
              >
                <div className="w-14 h-14 rounded-xl bg-amber-500/30 flex items-center justify-center shrink-0">
                  <Leaf size={24} className="text-amber-300" />
                </div>
                <div>
                  <div className="font-semibold text-lg text-amber-50">Baby Spinach</div>
                  <div className="text-amber-400 font-semibold text-sm flex items-center gap-1.5 mt-0.5">
                    <AlertTriangle size={14} /> Expires in 2 days
                  </div>
                </div>
              </motion.div>

              {/* Checkmark */}
              <motion.div
                style={{ opacity: checkOp, scale: checkScale }}
                className="absolute -right-4 -top-4 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.6)] z-50 border-4 border-[#050505]"
              >
                <CheckCircle2 className="text-white" size={22} />
              </motion.div>
            </motion.div>

          </motion.div>

          {/* Phase 3: Consume confirm */}
          <motion.div
            style={{ y: confirmY, opacity: confirmOp, zIndex: 40 }}
            className="absolute w-80 bg-white text-[#1A1A1A] rounded-[2rem] shadow-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#F4EBE9] flex items-center justify-center">
                  <Milk size={18} className="text-[#C8745D]" />
                </div>
                <div>
                  <div className="font-semibold">Consume A2 Milk</div>
                  <div className="text-xs text-gray-500">500ml from batch #42</div>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <motion.div
                  className="h-1.5 rounded-full bg-[#C8745D]"
                  initial={{ width: '85%' }}
                  animate={{ width: '60%' }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Before: 1.5L</span><span>After: 1.0L</span>
              </div>
            </div>
            <div className="p-4 bg-[#F5F2ED] text-center text-sm font-semibold text-[#C8745D]">
              Deduction applied
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
