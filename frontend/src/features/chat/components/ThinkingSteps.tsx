import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Loader2, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ThinkingStep } from '../store'
import { cn } from '@/lib/utils'

interface ThinkingStepsProps {
  steps: ThinkingStep[]
  isTyping: boolean
  thinkingContent?: string
}

export function ThinkingSteps({ steps, isTyping, thinkingContent }: ThinkingStepsProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  if (steps.length === 0) return null

  const lastStep = steps[steps.length - 1]
  const isActive = isTyping

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 text-xs transition-colors rounded-lg px-2 py-1 -ml-2',
          isActive
            ? 'text-[#C97B5C] hover:bg-[#C97B5C]/5'
            : 'text-stone-400 hover:bg-stone-100'
        )}
      >
        {isActive ? (
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        ) : (
          <CheckCircle2 className="w-3 h-3 shrink-0" />
        )}
        <span className="font-medium">
          {isActive ? lastStep.label : t('chat.thinkingCompleted', { count: steps.length })}
        </span>
        <ChevronDown
          className={cn(
            'w-3 h-3 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-1 mt-1 border-l-2 border-stone-200 pl-3 space-y-1">
              {steps.map((step, i) => {
                const isLast = i === steps.length - 1
                const isCurrent = isLast && isActive

                return (
                  <div
                    key={`${step.node}-${step.timestamp}`}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    {isCurrent ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin text-[#C97B5C] shrink-0" />
                    ) : (
                      <div className="w-2.5 h-2.5 flex items-center justify-center shrink-0">
                        <div className="w-1 h-1 rounded-full bg-stone-400" />
                      </div>
                    )}
                    <span
                      className={cn(
                        isCurrent ? 'text-[#C97B5C] font-medium' : 'text-stone-400'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
              {thinkingContent && (
                <p className="text-[11px] leading-relaxed text-stone-400 whitespace-pre-wrap break-words mt-1">
                  {thinkingContent}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
