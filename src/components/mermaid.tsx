'use client'

import { useEffect, useId, useState } from 'react'

/**
 * Renders a Mermaid diagram client-side. The diagram source is generated from committed
 * artifacts, never hand-drawn, and is shown as text when rendering fails so nothing is hidden.
 */
export function Mermaid({ chart, title }: { chart: string; title: string }) {
  const id = useId().replace(/:/g, '')
  const [svg, setSvg] = useState<string>('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' })
        const { svg: rendered } = await mermaid.render(`m${id}`, chart)
        if (!cancelled) setSvg(rendered)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    if (chart.trim()) void render()
    return () => {
      cancelled = true
    }
  }, [chart, id])

  if (failed || !chart.trim()) {
    return (
      <pre className="overflow-x-auto rounded bg-ink-50 p-3 text-xs text-ink-700">
        {chart || 'No diagram content.'}
      </pre>
    )
  }

  return (
    <figure className="overflow-x-auto">
      <figcaption className="sr-only">{title}</figcaption>
      {/* Mermaid output is generated from our own committed artifacts and rendered with
          securityLevel: 'strict', which strips scripts and event handlers. */}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  )
}
