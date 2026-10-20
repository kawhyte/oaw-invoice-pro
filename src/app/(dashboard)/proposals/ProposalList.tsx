'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { daysBetween } from '@/lib/dates'
import { effectiveStatus, formatMoney } from '@/lib/proposals'
import type { StoredProposalStatus } from '@/types'

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'changes', label: 'Changes requested' },
  { value: 'draft', label: 'Draft' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
  { value: 'declined', label: 'Declined' },
]

interface Row {
  id: string; proposal_number: string; title: string; recipient_name: string; currency: string; total: number
  status: StoredProposalStatus; valid_until: string; changes_requested_at: string | null
}

export function ProposalList({ proposals, totalCount, page, pageSize, initialQuery, status, today }: {
  proposals: Row[]; totalCount: number; page: number; pageSize: number; initialQuery: string; status: string; today: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQuery)

  const buildUrl = (q: string, s: string, p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (s !== 'all') params.set('status', s)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/proposals?${qs}` : '/proposals'
  }

  useEffect(() => {
    if (search === initialQuery) return
    const t = setTimeout(() => router.replace(buildUrl(search, status, 1)), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, title or PRO-#…"
          className="flex-1 min-w-0 px-4 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
        <select value={status} onChange={e => router.replace(buildUrl(search, e.target.value, 1))}
          className="select-field w-36 shrink-0 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]">
          {FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">{totalCount} proposal{totalCount !== 1 ? 's' : ''}</span>
          <Link href="/proposals/new" className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors">
            + New Proposal
          </Link>
        </div>
        {proposals.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            {initialQuery || status !== 'all' ? 'No proposals match your search.' : 'No proposals yet. Create one when a prospect asks for a quote.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
            {proposals.map(p => {
              const eff = effectiveStatus(p, today)
              const open = eff === 'sent' || eff === 'revised' || eff === 'draft'
              const days = daysBetween(today, p.valid_until)
              return (
                <Link key={p.id} href={`/proposals/${p.id}`}
                  className="block rounded-xl border border-[#e0e0e3] shadow-[0px_4px_20px_rgba(26,28,30,0.04)] p-4 hover:bg-[#f8f9fa] transition-colors min-w-0">
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <span className="font-mono font-medium text-[#1a1c1e]">{p.proposal_number}</span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {p.changes_requested_at && (eff === 'sent' || eff === 'revised') && <StatusChip status="changes" />}
                      <StatusChip status={eff} />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-[#1a1c1e] truncate">{p.title}</p>
                  <p className="text-sm text-[#5a5c62] truncate">{p.recipient_name}</p>
                  <div className="flex justify-between items-end gap-3 mt-3">
                    <span className={`text-xs ${open && days <= 7 ? 'text-amber-700 font-medium' : 'text-[#8a8c94]'}`}>
                      {eff === 'expired' ? `Expired ${-days} day${days === -1 ? '' : 's'} ago`
                        : open ? (days === 0 ? 'Expires today' : `Valid ${days} more day${days === 1 ? '' : 's'}`) : ''}
                    </span>
                    <span className="font-mono text-sm text-[#1a1c1e] shrink-0">{formatMoney(p.total, p.currency)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <button disabled={page <= 1} onClick={() => router.replace(buildUrl(search, status, page - 1))}
              className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg disabled:opacity-40 hover:bg-[#f8f9fa] transition-colors">← Prev</button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => router.replace(buildUrl(search, status, page + 1))}
              className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg disabled:opacity-40 hover:bg-[#f8f9fa] transition-colors">Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}
