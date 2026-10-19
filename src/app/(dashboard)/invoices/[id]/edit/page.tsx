import { and, desc, eq } from 'drizzle-orm'
import { db, invoices, business_settings, invoice_line_items, projects as projectsTable } from '@/db'
import { requireUserPage } from '@/lib/session'
import type { ComponentProps } from 'react'
import type { BusinessSettings } from '@/types'
import { redirect } from 'next/navigation'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUserPage()

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.user_id, user.id)),
    with: { invoice_line_items: { orderBy: invoice_line_items.sort_order }, projects: { with: { clients: true } } },
  })

  if (!invoice) redirect('/invoices')

  if (invoice.status === 'paid') redirect(`/invoices/${id}`)
  // Combined invoices (no single project) can't be edited in the standard form —
  // use "Separate" on the detail page to split them back into editable drafts.
  if (invoice.project_id === null) redirect(`/invoices/${id}`)

  const bizSettings = (await db.query.business_settings.findFirst({ where: eq(business_settings.user_id, user.id) })) ?? null

  const projects = await db.query.projects.findMany({
    where: eq(projectsTable.user_id, user.id),
    with: { clients: true },
    orderBy: desc(projectsTable.created_at),
  })

  const project = (invoice as any).projects

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">
          Edit {invoice.invoice_number}
        </h1>
        <p className="text-sm text-[#5a5c62] mt-1">
          {project?.clients?.name}{project?.title ? ` · ${project.title}` : ''}
        </p>
      </div>
      <InvoiceForm
        projects={projects as unknown as ComponentProps<typeof InvoiceForm>['projects']}
        bizSettings={bizSettings as BusinessSettings | null}
        invoice={invoice as any}
        editMode={true}
      />
    </div>
  )
}
