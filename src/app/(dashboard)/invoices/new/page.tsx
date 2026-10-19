import { and, desc, eq } from 'drizzle-orm'
import { db, projects, business_settings } from '@/db'
import { requireUserPage } from '@/lib/session'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'

export default async function NewInvoicePage() {
  const user = await requireUserPage()

  const [projectRows, bizSettings] = await Promise.all([
    db.query.projects.findMany({
      where: and(eq(projects.user_id, user.id), eq(projects.is_personal, false)),
      with: { clients: true },
      orderBy: desc(projects.created_at),
    }),
    db.query.business_settings.findFirst({ where: eq(business_settings.user_id, user.id) }),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">New Invoice</h1>
      </div>
      <InvoiceForm projects={projectRows as any} bizSettings={(bizSettings ?? null) as any} />
    </div>
  )
}
