// frontend/src/features/landing/components/LandingFooter.tsx
export function LandingFooter() {
  return (
    <footer
      className="border-t py-10 px-6"
      style={{ borderColor: 'var(--lp-surface-dark)', backgroundColor: 'var(--lp-bg)' }}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: 'var(--lp-brand)' }}
          >
            KL
          </div>
          <span className="font-semibold" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>Kitchen Loop</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--lp-ink-muted)' }}>
          &copy; {new Date().getFullYear()} Kitchen Loop. MIT licensed.
        </p>
        <div className="flex items-center gap-5 text-xs" style={{ color: 'var(--lp-ink-muted)' }}>
          <a href="https://github.com/SNOWOVERSEER/smart-kitchen-core" target="_blank" rel="noopener noreferrer" className="hover:underline">GitHub</a>
          <span>Privacy</span>
        </div>
      </div>
    </footer>
  )
}
