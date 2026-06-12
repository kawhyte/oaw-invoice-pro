import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { PaymentStagesTable } from '@/components/invoices/PaymentStagesTable'
import { InvoiceActions } from '@/components/invoices/InvoiceActions'

const STATUS_STYLES = { unpaid: 'bg-gray-100 text-gray-600', partial: 'bg-amber-100 text-amber-700', paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-700' }
const STATUS_LABELS = { unpaid: 'Unpaid', partial: 'Partially Paid', paid: 'Paid', overdue: 'Overdue' }

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, projects(title, clients(name, email)), invoice_payments(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!invoice) notFound()

  const project = invoice.projects as any
  const client = project?.clients
  const payments = [...(invoice.invoice_payments ?? [])].sort((a: any, b: any) =>
    new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  )
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(n)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/invoices" className="text-sm text-gray-400 hover:text-gray-600">← Invoices</Link>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[invoice.status as keyof typeof STATUS_STYLES]}`}>
              {STATUS_LABELS[invoice.status as keyof typeof STATUS_LABELS]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{client?.name} · {project?.title}</p>
        </div>
        <InvoiceActions invoiceId={id} clientEmail={client?.email ?? null} />
      </div>

      {/* Payment Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Payment Schedule</h2>
        </div>
        <PaymentStagesTable invoiceId={id} payments={payments as any} currency={invoice.currency} />
        <div className="px-6 py-4 border-t border-gray-100">
          <div className="flex justify-end">
            <div className="space-y-1.5 text-sm min-w-48">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(invoice.subtotal)}</span></div>
              {invoice.gct_rate > 0 && (
                <div className="flex justify-between text-gray-600"><span>GCT (15%)</span><span>{fmt(invoice.gct_amount)}</span></div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 text-base pt-2 border-t border-gray-200">
                <span>Total</span><span>{fmt(invoice.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Date Issued</p>
          <p className="text-gray-700">{new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Currency</p>
          <p className="text-gray-700">{invoice.currency}</p>
        </div>
        {invoice.notes && (
          <div className="col-span-2 sm:col-span-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Notes</p>
            <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
