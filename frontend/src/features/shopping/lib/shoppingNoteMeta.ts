export interface ShoppingNoteMeta {
  pkgSize?: number
  count?: number
  location?: string
  expiryDate?: string
}

interface ParsedShoppingNote {
  visibleNote: string
  meta: ShoppingNoteMeta
}

const META_RE = /\s*\[\[SKMETA:(.+?)\]\]\s*$/

export function parseShoppingNote(rawNote: string | null | undefined): ParsedShoppingNote {
  const raw = rawNote ?? ''
  const match = raw.match(META_RE)
  if (!match) return { visibleNote: raw, meta: {} }

  let meta: ShoppingNoteMeta = {}
  try {
    const parsed = JSON.parse(match[1]) as ShoppingNoteMeta
    if (parsed && typeof parsed === 'object') meta = parsed
  } catch {
    meta = {}
  }

  const visibleNote = raw.replace(META_RE, '').trimEnd()
  return { visibleNote, meta }
}

export function buildShoppingNote(
  visibleNote: string,
  meta: ShoppingNoteMeta
): string | undefined {
  const cleanVisibleNote = visibleNote.trim()
  const cleanMeta: ShoppingNoteMeta = {}

  if (typeof meta.pkgSize === 'number' && Number.isFinite(meta.pkgSize) && meta.pkgSize > 0) {
    cleanMeta.pkgSize = meta.pkgSize
  }
  if (typeof meta.count === 'number' && Number.isFinite(meta.count) && meta.count > 0) {
    cleanMeta.count = meta.count
  }
  if (typeof meta.location === 'string' && meta.location.trim()) {
    cleanMeta.location = meta.location.trim()
  }
  if (typeof meta.expiryDate === 'string' && meta.expiryDate.trim()) {
    cleanMeta.expiryDate = meta.expiryDate.trim()
  }

  if (
    cleanMeta.pkgSize == null &&
    cleanMeta.count == null &&
    cleanMeta.location == null &&
    cleanMeta.expiryDate == null
  ) {
    return cleanVisibleNote || undefined
  }

  const metaToken = `[[SKMETA:${JSON.stringify(cleanMeta)}]]`
  return cleanVisibleNote ? `${cleanVisibleNote}\n\n${metaToken}` : metaToken
}
