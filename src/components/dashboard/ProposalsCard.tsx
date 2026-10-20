import Link from 'next/link'
import { FileSignature } from 'lucide-react'
import { daysBetween } from '@/lib/dates'
import { formatMoney } from '@/lib/proposals'

export interface ProposalAlertRow {
  id: string
  proposal_number: string
  recipient_name: string
  currency: string
  total: number
  valid_until: string
  changes_requested_at: string | null
}

/**
 * Open proposals that need attention: the client asked for changes, or the
 * proposal expires within 7 days. Renders nothing when there are none.
 */
export function ProposalsCard({ proposals, today }: { proposals: ProposalAlertRow[]; today: string }) {
  if (proposals.length === 0) return null
  return (
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FileSignature size={16} className="text-[#715a3e]" /> Proposals needing attention
        </h2>
        <Link href="/proposals?status=open" className="text-xs text-[#715a3e] hover:underline shrink-0">All open →</Link>
      </div>
      <div className="divide-y divide-gray-100">
        {proposals.map(p => {
          const days = daysBetween(today, p.valid_until)
          return (
            <Link key={p.id} href={`/proposals/${p.id}`} className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 hover:bg-[#f8f9fa] transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1a1c1e] truncate">
                  <span className="font-mono">{p.proposal_number}</span> · {p.recipient_name}
                </p>
                <p className={`text-xs ${p.changes_requested_at ? 'text-amber-700' : days <= 2 ? 'text-[#93000a]' : 'text-[#8a8c94]'}`}>
                  {p.changes_requested_at ? 'Asked for changes' : days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`}
                </p>
              </div>
              <span className="text-sm font-mono text-[#1a1c1e] shrink-0">{formatMoney(p.total, p.currency)}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
