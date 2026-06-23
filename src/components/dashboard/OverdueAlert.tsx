import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface Props {
  count: number
  owingByCurrency: { currency: string; owing: number }[]
}

/**
 * Surfaces invoices that are actually past due (computed from due_date + balance,
 * not the stored status). Renders nothing when nothing is overdue, so the
 * dashboard stays clean when the user is on top of billing.
 */
export function OverdueAlert({ count, owingByCurrency }: Props) {
  if (count === 0) return null

  const fmt = (n: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  return (
    <Link
      href="/invoices"
      className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 hover:bg-amber-100/70 transition-colors"
    >
      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900">
          {count} overdue {count === 1 ? 'invoice' : 'invoices'}
        </p>
        <p className="text-xs text-amber-700 mt-0.5 truncate">
          {owingByCurrency.map(c => `${fmt(c.owing, c.currency)} owing`).join(' · ')} — tap to review
        </p>
      </div>
      <span className="ml-auto text-amber-700 text-lg shrink-0" aria-hidden>→</span>
    </Link>
  )
}
