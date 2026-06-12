'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Invoice } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}
const STATUS_LABELS: Record<string, string> = { draft: 'Draft', sent: 'Sent', partial: 'Partial', paid: 'Paid', overdue: 'Overdue' }
const ALL_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue']

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
      {/* Search + Filter */}
      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by client, invoice #, or location..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
          <option value="all">All Status</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={() => router.push('/invoices/new')} className="px-3 py-1.5 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors">
            + New Invoice
          </button>
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            {search || statusFilter !== 'all' ? 'No invoices match your search.' : 'No invoices yet.'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Owing</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(inv => {
                const owing = inv.total - inv.amount_paid
                return (
                  <tr key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{inv.projects?.clients?.name ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{inv.projects?.job_type ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-32 truncate">{inv.projects?.location_address ?? '—'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{fmt(inv.total, inv.currency)}</td>
                    <td className={`px-6 py-4 text-sm font-medium text-right ${owing > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{fmt(owing, inv.currency)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                        {STATUS_LABELS[inv.status]}
                      </span>
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
