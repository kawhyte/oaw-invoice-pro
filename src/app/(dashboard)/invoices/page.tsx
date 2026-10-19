import { and, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'
import { db, invoices as invoicesTable, clients, projects, invoice_line_items } from '@/db'
import { requireUserPage } from '@/lib/session'
import type { InvoiceStatus } from '@/types'
import { InvoiceList } from './InvoiceList'

const PAGE_SIZE = 25

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  const { page: pageParam, q: qParam, status: statusParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const status = statusParam ?? 'all'
  // LIKE wildcards in the user's text are matched literally.
  const q = (qParam ?? '').trim().replace(/[\\%_]/g, (c) => `\\${c}`)

  const user = await requireUserPage()

  const filters: SQL[] = [eq(invoicesTable.user_id, user.id)]
  if (status !== 'all') filters.push(eq(invoicesTable.status, status as InvoiceStatus))
  if (q) {
    // Search spans the invoice number, client name, and project title/location.
    const pattern = `%${q}%`
    filters.push(or(
      ilike(invoicesTable.invoice_number, pattern),
      inArray(invoicesTable.client_id,
        db.select({ id: clients.id }).from(clients).where(and(eq(clients.user_id, user.id), ilike(clients.name, pattern)))),
      inArray(invoicesTable.project_id,
        db.select({ id: projects.id }).from(projects).where(and(eq(projects.user_id, user.id),
          or(ilike(projects.location_address, pattern), ilike(projects.title, pattern))))),
    )!)
  }
  const where = and(...filters)

  const [invoices, count] = await Promise.all([
    db.query.invoices.findMany({
      where,
      with: {
        projects: {
          columns: { title: true, job_type: true, location_address: true },
          with: { clients: { columns: { name: true } } },
        },
        clients: { columns: { name: true } },
        invoice_line_items: { columns: { section_title: true }, orderBy: invoice_line_items.sort_order },
      },
      orderBy: desc(invoicesTable.created_at),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    db.$count(invoicesTable, where),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Invoices</h1>
      </div>
      <InvoiceList
        invoices={invoices as any}
        totalCount={count}
        page={page}
        pageSize={PAGE_SIZE}
        initialQuery={qParam ?? ''}
        status={status}
      />
    </div>
  )
}
