import { motion } from 'framer-motion'
import { ChefHat } from 'lucide-react'

export function TypingIndicator() {
  return (
    <div className="flex gap-2.5 items-start">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: '#C97B5C' }}
      >
        <ChefHat className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white border border-stone-200/60 shadow-[0_1px_6px_-2px_rgba(28,22,18,0.07)] rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5 items-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-stone-400 block"
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  )
}
