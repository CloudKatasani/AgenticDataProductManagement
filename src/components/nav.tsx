'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

/**
 * Nine tabs in five groups. The groups are the three front doors plus enablement and run —
 * consumer, practitioner and leadership navigation are never blended into one list.
 */

export const NAV_GROUPS: { group: string; items: { href: string; label: string; hint: string }[] }[] = [
  {
    group: 'Consume',
    items: [
      { href: '/marketplace', label: 'Marketplace', hint: 'Browse published data products' },
      { href: '/request', label: 'Request', hint: 'Describe a decision you cannot make today' },
    ],
  },
  {
    group: 'Build',
    items: [
      { href: '/inbox', label: 'My Work', hint: 'Approvals, reviews and agent proposals' },
      { href: '/products', label: 'Lifecycle Studio', hint: 'The 12-stage workbench' },
    ],
  },
  {
    group: 'Lead',
    items: [{ href: '/portfolio', label: 'Portfolio', hint: 'Pipeline, cost, adoption and value' }],
  },
  {
    group: 'Enable',
    items: [
      { href: '/patterns', label: 'Consumption Patterns', hint: 'The eight ways a product is used' },
      { href: '/agents', label: 'Agents', hint: 'Charters, autonomy, supervision and cost' },
      { href: '/academy', label: 'Academy', hint: 'How data products work here' },
    ],
  },
  {
    group: 'Run',
    items: [{ href: '/admin', label: 'Admin', hint: 'Packs, roles, controls and configuration' }],
  },
]

export function MainNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {NAV_GROUPS.map((group) => (
        <div key={group.group} className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {group.group}
          </span>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.hint}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'rounded-md px-2.5 py-1.5 text-sm font-medium transition',
                  active
                    ? 'bg-accent-600 text-white'
                    : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
