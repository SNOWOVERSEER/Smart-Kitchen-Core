import { useState, useRef, type KeyboardEvent } from 'react'
import { Send, Camera, Mic } from 'lucide-react'
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

  return (
    <div className="border-t border-border bg-card px-3 py-2">
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
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="flex-1 flex items-end bg-muted rounded-xl px-3 py-2 gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('chat.placeholder')}
            rows={1}
            disabled={disabled}
            className={cn(
              'flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-32 leading-5',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
          />
          <button className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <Mic className="w-3.5 h-3.5" />
          </button>
        </div>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0',
            text.trim() && !disabled
              ? 'bg-foreground text-background hover:bg-foreground/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-1.5">
        {t('chat.disclaimer')}
      </p>
    </div>
  )
}
