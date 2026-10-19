import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, clients, projects as projectsTable, invoices as invoicesTable, business_settings, invoice_line_items } from '@/db'
import { requireUserPage } from '@/lib/session'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { CombinedInvoiceForm } from '@/components/invoices/CombinedInvoiceForm'
import type { BusinessSettings } from '@/types'

interface RawLineItem { description: string; quantity: number; unit_price: number; sort_order: number }
interface RawInvoice {
  id: string
  project_id: string | null
  invoice_number: string
  status: string
  amount_paid: number
  currency: string
  invoice_line_items: RawLineItem[]
}

export default async function NewCombinedInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const { clientId } = await searchParams
  if (!clientId) notFound()

  const user = await requireUserPage()

  const client = await db.query.clients.findFirst({
    columns: { id: true, name: true, currency: true },
    where: and(eq(clients.id, clientId), eq(clients.user_id, user.id)),
  })
  if (!client) notFound()

  const projects = await db.select({ id: projectsTable.id, title: projectsTable.title }).from(projectsTable)
    .where(and(eq(projectsTable.user_id, user.id), eq(projectsTable.client_id, clientId)))
    .orderBy(desc(projectsTable.created_at))

  if (!projects || projects.length < 2) {
    // Combining needs at least two projects — send the user back to the client.
    redirect(`/clients/${clientId}`)
  }

  const projectIds = projects.map(p => p.id)
  const invoices = await db.query.invoices.findMany({
    columns: { id: true, project_id: true, invoice_number: true, status: true, amount_paid: true, currency: true },
    with: { invoice_line_items: { columns: { description: true, quantity: true, unit_price: true, sort_order: true }, orderBy: invoice_line_items.sort_order } },
    where: and(eq(invoicesTable.user_id, user.id), inArray(invoicesTable.project_id, projectIds)),
  })

  const bizSettings = (await db.query.business_settings.findFirst({ where: eq(business_settings.user_id, user.id) })) ?? null

  // Group each project's draft (absorbable) and already-billed (informational) invoices.
  const byProject = (invoices ?? []) as RawInvoice[]
  const projectData = projects.map(p => {
    const own = byProject.filter(inv => inv.project_id === p.id)
    const draft = own.find(inv => inv.status === 'draft')
    const billed = own
      .filter(inv => inv.status !== 'draft')
      .map(inv => ({ invoice_number: inv.invoice_number, status: inv.status }))
    return {
      id: p.id,
      title: p.title,
      draftInvoice: draft
        ? {
            id: draft.id,
            invoice_number: draft.invoice_number,
            amount_paid: Number(draft.amount_paid) || 0,
            items: [...draft.invoice_line_items]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(i => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
          }
        : null,
      billed,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/clients/${clientId}`} className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">← {client.name}</Link>
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e] mt-2">Combined Invoice</h1>
        <p className="text-sm text-[#5a5c62] mt-0.5">Bill several of {client.name}&apos;s projects on one invoice.</p>
      </div>
      <CombinedInvoiceForm
        client={{ id: client.id, name: client.name, currency: (client.currency as 'JMD' | 'USD' | null) }}
        projects={projectData}
        bizSettings={(bizSettings as BusinessSettings) ?? null}
      />
    </div>
  )
}
