import Link from 'next/link'

const STATUS_STYLES = {
  unpaid: 'bg-gray-100 text-gray-600',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}
const STATUS_LABELS = { unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid', overdue: 'Overdue' }

interface InvoiceRow {
  id: string
  invoice_number: string
  total: number
  currency: string
  status: keyof typeof STATUS_STYLES
  created_at: string
  projects: { title: string; clients: { name: string } | null } | null
}

export function RecentInvoices({ invoices }: { invoices: InvoiceRow[] }) {
  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Recent Invoices</h2>
        <Link href="/invoices" className="text-sm text-blue-600 hover:text-blue-800 font-medium">View all →</Link>
      </div>
      {invoices.length === 0 ? (
        <div className="px-6 py-8 text-center text-gray-400 text-sm">No invoices yet.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {invoices.map(inv => (
            <Link key={inv.id} href={`/invoices/${inv.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">{inv.invoice_number}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {inv.projects?.clients?.name ?? '—'} · {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-medium text-gray-900">{fmt(inv.total, inv.currency)}</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                  {STATUS_LABELS[inv.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
