import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { InvoiceActions } from '@/components/invoices/InvoiceActions'
import { AmountPaidForm } from '@/components/invoices/AmountPaidForm'
import { StatusChip } from '@/components/ui/StatusChip'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, projects(id, title, job_type, location_address, clients(name, email)), invoice_line_items(*)')
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
          <Link href="/invoices" className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">← Invoices</Link>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">{invoice.invoice_number}</h1>
            <StatusChip status={invoice.status} />
          </div>
          <p className="text-sm text-[#5a5c62] mt-0.5">
            {client?.name}
            {project && (
              <>
                {' · '}
                <Link
                  href={`/projects/${project.id}`}
                  className="text-[#715a3e] hover:text-[#8b7355] hover:underline transition-colors"
                >
                  {project.title}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {invoice.status !== 'paid' && (
            <Link
              href={`/invoices/${id}/edit`}
              className="px-4 py-2 text-sm font-medium border border-[#e0e0e3] text-[#1a1c1e] rounded-lg hover:bg-[#f8f9fa] transition-colors"
            >
              Edit
            </Link>
          )}
          <InvoiceActions invoiceId={id} invoiceNumber={invoice.invoice_number} clientEmail={client?.email ?? null} status={invoice.status} />
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="label-caps">Line Items</h2>
        </div>
        <table className="w-full">
          <thead className="bg-[#f8f9fa]">
            <tr>
              <th className="px-6 py-3 text-left label-caps">Description</th>
              <th className="px-6 py-3 text-center label-caps">Qty</th>
              <th className="px-6 py-3 text-right label-caps">Unit Price</th>
              <th className="px-6 py-3 text-right label-caps">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineItems.map((item: any) => (
              <tr key={item.id}>
                <td className="px-6 py-3 text-sm text-[#1a1c1e]">{item.description}</td>
                <td className="px-6 py-3 text-sm text-[#5a5c62] text-center data-mono">{item.quantity}</td>
                <td className="px-6 py-3 text-sm text-[#5a5c62] text-right data-mono">{fmt(item.unit_price)}</td>
                <td className="px-6 py-3 text-sm font-medium text-[#1a1c1e] text-right data-mono">{fmt(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary */}
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex justify-end">
            <div className="space-y-1.5 text-sm w-56">
              <div className="flex justify-between text-[#5a5c62]"><span>Subtotal</span><span className="data-mono">{fmt(invoice.subtotal)}</span></div>
              {invoice.discount_value > 0 && (
                <div className="flex justify-between text-[#5a5c62]">
                  <span>Discount {invoice.discount_type === 'percentage' ? `(${invoice.discount_value}%)` : ''}</span>
                  <span className="data-mono">- {fmt(invoice.discount_type === 'percentage' ? invoice.subtotal * (invoice.discount_value / 100) : invoice.discount_value)}</span>
                </div>
              )}
              {invoice.gct_rate > 0 && <div className="flex justify-between text-[#5a5c62]"><span>GCT (15%)</span><span className="data-mono">{fmt(invoice.gct_amount)}</span></div>}
              {invoice.additions_amount > 0 && (
                <div className="flex justify-between text-[#5a5c62]">
                  <span>{invoice.additions_description || 'Additions'}</span>
                  <span className="data-mono">+ {fmt(invoice.additions_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[#1a1c1e] text-base pt-2 border-t border-[#e0e0e3]"><span>Total</span><span className="data-mono">{fmt(invoice.total)}</span></div>
              <div className="flex justify-between text-[#2a5130]"><span>Paid</span><span className="data-mono">{fmt(invoice.amount_paid)}</span></div>
              <div className="flex justify-between font-semibold text-amber-600"><span>Owing</span><span className="data-mono">{fmt(owing)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Amount Paid Tracker */}
      <AmountPaidForm invoiceId={id} currentAmountPaid={invoice.amount_paid} total={invoice.total} currency={invoice.currency} />

      {/* Meta */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="label-caps mb-1">Date Issued</p>
          <p className="text-[#5a5c62]">{new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        {invoice.due_date && (
          <div>
            <p className="label-caps mb-1">Due Date</p>
            <p className="text-[#5a5c62]">{new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        )}
        <div>
          <p className="label-caps mb-1">Currency</p>
          <p className="text-[#5a5c62]">{invoice.currency}</p>
        </div>
        {invoice.notes && (
          <div className="col-span-2 sm:col-span-3">
            <p className="label-caps mb-1">Notes</p>
            <p className="text-[#5a5c62] whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
