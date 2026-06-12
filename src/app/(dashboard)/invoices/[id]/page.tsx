import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { InvoiceActions } from '@/components/invoices/InvoiceActions'
import { AmountPaidForm } from '@/components/invoices/AmountPaidForm'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', partial: 'Partial', paid: 'Paid', overdue: 'Overdue'
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, projects(title, job_type, location_address, clients(name, email)), invoice_line_items(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!invoice) notFound()

  const project = invoice.projects as any
  const client = project?.clients
  const lineItems = [...(invoice.invoice_line_items ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order)
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(n)
  const owing = invoice.total - invoice.amount_paid

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/invoices" className="text-sm text-gray-400 hover:text-gray-600">← Invoices</Link>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[invoice.status]}`}>
              {STATUS_LABELS[invoice.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {client?.name}
            {project?.job_type ? ` · ${project.job_type}` : ''}
            {project?.location_address ? ` · ${project.location_address}` : ''}
          </p>
        </div>
        <InvoiceActions invoiceId={id} clientEmail={client?.email ?? null} status={invoice.status} />
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineItems.map((item: any) => (
              <tr key={item.id}>
                <td className="px-6 py-3 text-sm text-gray-900">{item.description}</td>
                <td className="px-6 py-3 text-sm text-gray-600 text-center">{item.quantity}</td>
                <td className="px-6 py-3 text-sm text-gray-600 text-right">{fmt(item.unit_price)}</td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">{fmt(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex justify-end">
            <div className="space-y-1.5 text-sm w-56">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(invoice.subtotal)}</span></div>
              {invoice.discount_value > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Discount {invoice.discount_type === 'percentage' ? `(${invoice.discount_value}%)` : ''}</span>
                  <span>- {fmt(invoice.discount_type === 'percentage' ? invoice.subtotal * (invoice.discount_value / 100) : invoice.discount_value)}</span>
                </div>
              )}
              {invoice.gct_rate > 0 && <div className="flex justify-between text-gray-600"><span>GCT (15%)</span><span>{fmt(invoice.gct_amount)}</span></div>}
              {invoice.additions_amount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{invoice.additions_description || 'Additions'}</span>
                  <span>+ {fmt(invoice.additions_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200"><span>Total</span><span>{fmt(invoice.total)}</span></div>
              <div className="flex justify-between text-green-600"><span>Paid</span><span>{fmt(invoice.amount_paid)}</span></div>
              <div className="flex justify-between font-semibold text-amber-600"><span>Owing</span><span>{fmt(owing)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Amount Paid Tracker */}
      <AmountPaidForm invoiceId={id} currentAmountPaid={invoice.amount_paid} total={invoice.total} currency={invoice.currency} />

      {/* Meta */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Date Issued</p>
          <p className="text-gray-700">{new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        {invoice.due_date && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Due Date</p>
            <p className="text-gray-700">{new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Currency</p>
          <p className="text-gray-700">{invoice.currency}</p>
        </div>
        {invoice.notes && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
