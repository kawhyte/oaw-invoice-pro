import { Fragment } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { InvoiceActions } from '@/components/invoices/InvoiceActions'
import { SeparateInvoiceButton } from '@/components/invoices/SeparateInvoiceButton'
import { AmountPaidForm } from '@/components/invoices/AmountPaidForm'
import { StatusChip } from '@/components/ui/StatusChip'
import { discountAmountFor } from '@/lib/invoiceCalc'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, projects(id, title, job_type, location_address, clients(id, name, email)), clients(id, name, email), invoice_line_items(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!invoice) notFound()

  const project = invoice.projects as any
  // Combined invoices link the client directly; single-project ones via the project.
  const client = (invoice.clients as any) ?? project?.clients
  const lineItems = [...(invoice.invoice_line_items ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order)
  const isCombined = lineItems.some((li: any) => li.project_id)
  const sections: { title: string; items: any[]; subtotal: number }[] = []
  if (isCombined) {
    for (const li of lineItems) {
      const title = li.section_title || 'Project'
      let sec = sections.find(s => s.title === title)
      if (!sec) { sec = { title, items: [], subtotal: 0 }; sections.push(sec) }
      sec.items.push(li)
      sec.subtotal += Number(li.amount)
    }
  }
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(n)
  const owing = invoice.total - invoice.amount_paid

  // Projects this invoice's PDF can be saved to: the single project, or — for a
  // combined invoice — each project it bills (deduped, named by section title).
  const saveTargets: { id: string; title: string }[] = isCombined
    ? Array.from(
        (lineItems as { project_id: string | null; section_title: string | null }[]).reduce((m, li) => {
          if (li.project_id && !m.has(li.project_id)) m.set(li.project_id, li.section_title || 'Project')
          return m
        }, new Map<string, string>()),
        ([id, title]) => ({ id, title })
      )
    : project
    ? [{ id: project.id, title: project.title }]
    : []

  // Whether this invoice already has a saved PDF (drives "Update saved copy").
  const { data: savedFiles } = await supabase
    .from('project_files')
    .select('id, project_id')
    .eq('invoice_id', id)
    .limit(1)
  const savedFile = (savedFiles?.[0] as { id: string; project_id: string } | undefined)
    ? { id: savedFiles![0].id, projectId: savedFiles![0].project_id }
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/invoices" className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">← Invoices</Link>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">{invoice.invoice_number}</h1>
            <StatusChip status={invoice.status} />
            {isCombined && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5ede4] border border-[#715a3e]/20 text-[#715a3e] font-medium">
                Combined · {sections.length} projects
              </span>
            )}
          </div>
          <p className="text-sm text-[#5a5c62] mt-0.5">
            {client?.id ? (
              <Link
                href={`/clients/${client.id}`}
                className="text-[#715a3e] hover:text-[#8b7355] hover:underline transition-colors"
              >
                {client.name}
              </Link>
            ) : (
              client?.name
            )}
            {!isCombined && project && (
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
          {invoice.status !== 'paid' && !isCombined && (
            <Link
              href={`/invoices/${id}/edit`}
              className="px-4 py-2 text-sm font-medium border border-[#e0e0e3] text-[#1a1c1e] rounded-lg hover:bg-[#f8f9fa] transition-colors"
            >
              Edit
            </Link>
          )}
          {isCombined && invoice.status === 'draft' && (
            <SeparateInvoiceButton invoiceId={id} projectCount={sections.length} />
          )}
          <InvoiceActions invoiceId={id} invoiceNumber={invoice.invoice_number} clientEmail={client?.email ?? null} status={invoice.status} saveTargets={saveTargets} savedFile={savedFile} />
        </div>
      </div>

      {/* Combined invoice explainer — names the projects in plain language */}
      {isCombined && (
        <div className="bg-[#f5ede4] border border-[#715a3e]/20 rounded-xl px-5 py-3 text-sm text-[#1a1c1e]">
          <span className="font-semibold">Combined invoice.</span> This one invoice bills{' '}
          {sections.length} projects together:{' '}
          {sections.map((s, i) => (
            <span key={s.title}>
              {i > 0 && (i === sections.length - 1 ? ' and ' : ', ')}
              <span className="font-medium">{s.title}</span>
            </span>
          ))}
          . Each is itemized below with its own subtotal, then totaled once.
          {invoice.status === 'draft' && ' Use “Separate” above to split it back into individual invoices.'}
        </div>
      )}

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
            {isCombined
              ? sections.map(sec => (
                  <Fragment key={sec.title}>
                    <tr className="bg-[#f5ede4]/50">
                      <td colSpan={4} className="px-6 py-2 label-caps text-[#715a3e]">{sec.title}</td>
                    </tr>
                    {sec.items.map((item: any) => (
                      <tr key={item.id}>
                        <td className="px-6 py-3 text-sm text-[#1a1c1e]">{item.description}</td>
                        <td className="px-6 py-3 text-sm text-[#5a5c62] text-center data-mono">{item.quantity}</td>
                        <td className="px-6 py-3 text-sm text-[#5a5c62] text-right data-mono">{fmt(item.unit_price)}</td>
                        <td className="px-6 py-3 text-sm font-medium text-[#1a1c1e] text-right data-mono">{fmt(item.amount)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} className="px-6 py-2 text-xs text-[#8a8c94] text-right">{sec.title} subtotal</td>
                      <td className="px-6 py-2 text-sm font-semibold text-[#1a1c1e] text-right data-mono">{fmt(sec.subtotal)}</td>
                    </tr>
                  </Fragment>
                ))
              : lineItems.map((item: any) => (
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
                  <span className="data-mono">- {fmt(discountAmountFor(invoice.subtotal, invoice.discount_type, invoice.discount_value))}</span>
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
