'use client'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { QuickPayButton } from '@/components/invoices/QuickPayButton'

interface InvoiceRow {
  id: string
  invoice_number: string
  total: number
  amount_paid: number
  currency: string
  status: string
  created_at: string
  project_id: string | null
  projects: { title: string; clients: { name: string } | null } | null
  clients: { name: string } | null
}

export function RecentInvoices({ invoices }: { invoices: InvoiceRow[] }) {
  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-[#1a1c1e]">Recent Invoices</h2>
        <Link href="/invoices" className="text-sm text-[#715a3e] hover:text-[#8b7355] font-medium">View all →</Link>
      </div>
      {invoices.length === 0 ? (
        <div className="px-6 py-8 text-center text-gray-400 text-sm">No invoices yet.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {invoices.map(inv => (
            <Link key={inv.id} href={`/invoices/${inv.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[#f8f9fa] transition-colors">
              <div>
                <p className="text-sm font-medium text-[#1a1c1e] flex items-center gap-2">
                  {inv.invoice_number}
                  {inv.project_id === null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f5ede4] border border-[#715a3e]/20 text-[#715a3e] font-medium">Combined</span>
                  )}
                </p>
                <p className="text-xs text-[#8a8c94] mt-0.5">
                  {inv.projects?.clients?.name ?? inv.clients?.name ?? '—'} · {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium text-[#1a1c1e] data-mono">{fmt(inv.total, inv.currency)}</p>
                <StatusChip status={inv.status} />
                <QuickPayButton invoiceId={inv.id} invoiceNumber={inv.invoice_number} total={inv.total} amountPaid={inv.amount_paid} currency={inv.currency} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
