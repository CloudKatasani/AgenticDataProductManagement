import Link from 'next/link'
import type { ReactNode } from 'react'
import { clsx } from 'clsx'

/**
 * A deliberately small primitive set. Every element here is keyboard reachable, labelled and
 * meets AA contrast; nothing is a div pretending to be a button.
 */

export function Card({
  children,
  className,
  as: As = 'section',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'article' | 'div'
}) {
  return (
    <As className={clsx('rounded-lg border border-ink-200 bg-white shadow-sm', className)}>
      {children}
    </As>
  )
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  )
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('px-5 py-4', className)}>{children}</div>
}

const TONES = {
  neutral: 'bg-ink-100 text-ink-700 border-ink-200',
  good: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
  bad: 'bg-rose-50 text-rose-800 border-rose-200',
  info: 'bg-accent-50 text-accent-700 border-accent-100',
  agent: 'bg-agent-50 text-agent-700 border-agent-200',
} as const

export type Tone = keyof typeof TONES

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: Tone
  title?: string
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        TONES[tone],
      )}
    >
      {children}
    </span>
  )
}

const BUTTON_VARIANTS = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700 border-accent-600',
  secondary: 'bg-white text-ink-800 hover:bg-ink-50 border-ink-300',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100 border-transparent',
} as const

export function Button({
  children,
  variant = 'primary',
  type = 'submit',
  name,
  value,
  disabled,
  className,
  title,
  onClick,
}: {
  children: ReactNode
  variant?: keyof typeof BUTTON_VARIANTS
  type?: 'submit' | 'button' | 'reset'
  name?: string
  value?: string
  disabled?: boolean
  className?: string
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      name={name}
      value={value}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function LinkButton({
  href,
  children,
  variant = 'secondary',
  className,
}: {
  href: string
  children: ReactNode
  variant?: keyof typeof BUTTON_VARIANTS
  className?: string
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition',
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
  required,
}: {
  label: string
  htmlFor: string
  hint?: ReactNode
  children: ReactNode
  required?: boolean
}) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink-800">
        {label}
        {required ? <span className="ml-1 text-rose-600" aria-hidden="true">*</span> : null}
      </label>
      {hint ? (
        <p id={`${htmlFor}-hint`} className="mb-1.5 text-xs text-ink-600">
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  )
}

export const inputClass =
  'w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400'

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {children ? <div className="mt-2 text-sm text-ink-600">{children}</div> : null}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">{title}</h1>
        {description ? <div className="mt-2 text-sm text-ink-600">{description}</div> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  )
}

export function DataList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-500">{row.label}</dt>
          <dd className="mt-0.5 text-sm text-ink-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone
  title: string
  children?: ReactNode
}) {
  return (
    <div className={clsx('rounded-md border px-4 py-3 text-sm', TONES[tone])}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
      {children}
    </p>
  )
}
