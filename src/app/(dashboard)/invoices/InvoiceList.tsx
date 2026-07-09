'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Invoice } from '@/types'
import { StatusChip } from '@/components/ui/StatusChip'
import { QuickPayButton } from '@/components/invoices/QuickPayButton'

const ALL_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue']
const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', partial: 'Partial', paid: 'Paid', overdue: 'Overdue' }

interface InvoiceRow extends Omit<Invoice, 'projects' | 'clients' | 'invoice_line_items'> {
  projects: { title: string; job_type: string | null; location_address: string | null; clients: { name: string } | null } | null
  clients: { name: string } | null
  invoice_line_items?: { section_title: string | null }[]
}

const clientName = (inv: InvoiceRow) => inv.projects?.clients?.name ?? inv.clients?.name ?? '—'
const combinedProjectNames = (inv: InvoiceRow) =>
  inv.project_id === null
    ? ([...new Set((inv.invoice_line_items ?? []).map(li => li.section_title).filter(Boolean))] as string[])
    : []

export function InvoiceList({ invoices, totalCount, page, pageSize, initialQuery, status }: {
  invoices: InvoiceRow[]
  totalCount: number
  page: number
  pageSize: number
  initialQuery: string
  status: string
}) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQuery)

  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  const buildUrl = (q: string, s: string, p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (s !== 'all') params.set('status', s)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/invoices?${qs}` : '/invoices'
  }

  // Debounced search → URL (server does the filtering). Changing the search
  // always resets to page 1.
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
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by client, invoice #, or location..."
          className="flex-1 px-4 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
        <select value={status} onChange={e => router.replace(buildUrl(search, e.target.value, 1))}
          className="select-field px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]">
          <option value="all">All Status</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">{totalCount} invoice{totalCount !== 1 ? 's' : ''}</span>
          <button onClick={() => router.push('/invoices/new')} className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors">
            + New Invoice
          </button>
        </div>
        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            {initialQuery || status !== 'all' ? 'No invoices match your search.' : 'No invoices yet.'}
          </div>
        ) : (
          <>
            <div className="block lg:hidden space-y-3 p-4">
              {invoices.map(invoice => {
                const owing = invoice.total - invoice.amount_paid
                return (
                  <Link key={invoice.id} href={`/invoices/${invoice.id}`}
                    className="block bg-white rounded-xl border border-[#e0e0e3] shadow-[0px_4px_20px_rgba(26,28,30,0.04)] p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-[#1a1c1e]">{invoice.invoice_number}</span>
                        {invoice.project_id === null && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f5ede4] border border-[#715a3e]/20 text-[#715a3e] font-medium">Combined</span>
                        )}
                      </div>
                      <StatusChip status={invoice.status} />
                    </div>
                    <p className="text-sm text-[#5a5c62] mb-1">
                      {clientName(invoice)}
                      {invoice.projects?.job_type ? ` · ${invoice.projects.job_type}` : ''}
                    </p>
                    {invoice.project_id === null && combinedProjectNames(invoice).length > 0 && (
                      <p className="text-xs text-[#8a8c94] mb-3">{combinedProjectNames(invoice).join(' + ')}</p>
                    )}
                    <div className="flex justify-between text-sm">
                      <div>
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#8a8c94] mb-0.5">Total</p>
                        <p className="font-mono">{invoice.currency} {Number(invoice.total).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#8a8c94] mb-0.5">Owing</p>
                        <p className="font-mono text-[#715a3e]">{invoice.currency} {Number(owing).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <QuickPayButton invoiceId={invoice.id} invoiceNumber={invoice.invoice_number} total={invoice.total} amountPaid={invoice.amount_paid} currency={invoice.currency} />
                    </div>
                  </Link>
                )
              })}
            </div>
            <div className="hidden lg:block">
              <table className="w-full">
                <thead className="bg-[#f8f9fa]">
                  <tr>
                    <th className="px-6 py-3 text-left label-caps">Invoice #</th>
                    <th className="px-6 py-3 text-left label-caps">Client</th>
                    <th className="px-6 py-3 text-left label-caps">Job Type</th>
                    <th className="px-6 py-3 text-left label-caps">Location</th>
                    <th className="px-6 py-3 text-right label-caps">Total</th>
                    <th className="px-6 py-3 text-right label-caps">Owing</th>
                    <th className="px-6 py-3 text-left label-caps">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map(inv => {
                    const owing = inv.total - inv.amount_paid
                    return (
                      <tr key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)} className="hover:bg-[#f8f9fa] cursor-pointer transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-[#1a1c1e] data-mono">
                          <span className="inline-flex items-center gap-2">
                            {inv.invoice_number}
                            {inv.project_id === null && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f5ede4] border border-[#715a3e]/20 text-[#715a3e] font-medium">Combined</span>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#5a5c62]">{clientName(inv)}</td>
                        <td className="px-6 py-4 text-sm text-[#8a8c94]">
                          {inv.project_id === null
                            ? (combinedProjectNames(inv).join(' + ') || 'Multiple projects')
                            : (inv.projects?.job_type ?? '—')}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#8a8c94] max-w-32 truncate">{inv.projects?.location_address ?? '—'}</td>
                        <td className="px-6 py-4 text-sm font-medium text-[#1a1c1e] text-right data-mono">{fmt(inv.total, inv.currency)}</td>
                        <td className={`px-6 py-4 text-sm font-medium text-right data-mono ${owing > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{fmt(owing, inv.currency)}</td>
                        <td className="px-6 py-4">
                          <StatusChip status={inv.status} />
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <QuickPayButton invoiceId={inv.id} invoiceNumber={inv.invoice_number} total={inv.total} amountPaid={inv.amount_paid} currency={inv.currency} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <button disabled={page <= 1} onClick={() => router.replace(buildUrl(search, status, page - 1))}
              className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg disabled:opacity-40 hover:bg-[#f8f9fa] transition-colors">
              ← Prev
            </button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => router.replace(buildUrl(search, status, page + 1))}
              className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg disabled:opacity-40 hover:bg-[#f8f9fa] transition-colors">
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
