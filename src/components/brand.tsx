/**
 * The product's own mark, drawn in the brand gradient. It is deliberately a generic geometric
 * glyph — three rising bars behind a decision tick — and not any organisation's logo, so nothing
 * here asserts an endorsement the repository cannot back up. Swap the SVG for an approved asset
 * when one is available; nothing else needs to change.
 */
export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`brand-rule inline-flex shrink-0 items-center justify-center rounded-md ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth={2.2}>
        <path d="M4 19V13" strokeLinecap="round" />
        <path d="M10 19V9" strokeLinecap="round" />
        <path d="M16 19v-4" strokeLinecap="round" />
        <path d="M13.5 7.5 16.5 10.5 21 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/** The wordmark, sized for the brand bar. The product name is fixed; only the styling is ours. */
export function BrandWordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className={`text-sm font-semibold ${onDark ? 'text-white' : 'text-ink-900'}`}>
        Agentic Data Product Management
      </span>
      <span
        className={`text-[10px] font-medium uppercase tracking-[0.14em] ${
          onDark ? 'text-brand-300' : 'text-ink-500'
        }`}
      >
        Agents act · Humans decide
      </span>
    </span>
  )
}
