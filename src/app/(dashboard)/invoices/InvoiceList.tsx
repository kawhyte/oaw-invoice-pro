'use client'
import { useRouter } from 'next/navigation'

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

export function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter()
  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">All Invoices</span>
        <button onClick={() => router.push('/invoices/new')} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          + New Invoice
        </button>
      </div>
      {invoices.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-400 text-sm">No invoices yet.</div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map(inv => (
              <tr key={inv.id} onClick={() => router.push(`/invoices/${inv.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{inv.projects?.clients?.name ?? '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{inv.projects?.title ?? '—'}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{fmt(inv.total, inv.currency)}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                    {STATUS_LABELS[inv.status]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
