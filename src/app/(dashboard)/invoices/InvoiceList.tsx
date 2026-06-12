'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Invoice } from '@/types'
import { StatusChip } from '@/components/ui/StatusChip'

const ALL_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue']
const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', partial: 'Partial', paid: 'Paid', overdue: 'Overdue' }

interface InvoiceRow extends Omit<Invoice, 'projects'> {
  projects: { title: string; job_type: string | null; location_address: string | null; clients: { name: string } | null } | null
}

export function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.projects?.clients?.name ?? '').toLowerCase().includes(q) ||
      (inv.projects?.location_address ?? '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by client, invoice #, or location..."
          className="flex-1 px-4 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]">
          <option value="all">All Status</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={() => router.push('/invoices/new')} className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors">
            + New Invoice
          </button>
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            {search || statusFilter !== 'all' ? 'No invoices match your search.' : 'No invoices yet.'}
          </div>
        ) : (
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(inv => {
                const owing = inv.total - inv.amount_paid
                return (
                  <tr key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)} className="hover:bg-[#f8f9fa] cursor-pointer transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-[#1a1c1e] data-mono">{inv.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-[#5a5c62]">{inv.projects?.clients?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-[#8a8c94]">{inv.projects?.job_type ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-[#8a8c94] max-w-32 truncate">{inv.projects?.location_address ?? '—'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-[#1a1c1e] text-right data-mono">{fmt(inv.total, inv.currency)}</td>
                    <td className={`px-6 py-4 text-sm font-medium text-right data-mono ${owing > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{fmt(owing, inv.currency)}</td>
                    <td className="px-6 py-4">
                      <StatusChip status={inv.status} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
