import { useState, useRef, type KeyboardEvent } from 'react'
import { Send, Camera } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (text: string) => void
  onPhoto?: (base64: string) => void
  disabled?: boolean
  value?: string
  onChange?: (v: string) => void
}

export function ChatInput({ onSend, onPhoto, disabled, value, onChange }: ChatInputProps) {
  const { t } = useTranslation()
  const [internal, setInternal] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const text = value ?? internal
  const setText = onChange ?? setInternal

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onPhoto) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onPhoto(reader.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const canSend = text.trim() && !disabled

  return (
    <div className="border-t border-stone-200/60 bg-white px-3 py-2.5">
      <div className="flex items-end gap-2">
        {onPhoto && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors shrink-0 disabled:opacity-40"
            >
              <Camera className="w-[18px] h-[18px]" />
            </button>
          </>
        )}

        <div className="flex-1 flex items-end bg-stone-100/70 rounded-2xl px-3.5 py-2.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('chat.placeholder')}
            rows={1}
            disabled={disabled}
            className={cn(
              'flex-1 bg-transparent text-sm text-[#1C1612] placeholder:text-stone-400 resize-none outline-none max-h-32 leading-5',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
          />
        </div>

        <motion.button
          whileTap={canSend ? { scale: 0.9 } : undefined}
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-xl transition-all shrink-0',
            canSend
              ? 'bg-[#1C1612] text-white shadow-sm hover:bg-[#1C1612]/90'
              : 'bg-stone-100 text-stone-300 cursor-not-allowed'
          )}
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </div>
      <p className="text-[10px] text-stone-400 text-center mt-1.5">
        {t('chat.disclaimer')}
      </p>
    </div>
  )
}
