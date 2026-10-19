import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db, clients, projects as projectsTable, invoices as invoicesTable, invoice_line_items } from '@/db'
import { requireUserPage } from '@/lib/session'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { EditClientButton } from '@/components/clients/EditClientButton'
import type { Client } from '@/types'

const fmtMoney = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUserPage()

  const client = await db.query.clients.findFirst({ where: and(eq(clients.id, id), eq(clients.user_id, user.id)) })

  if (!client) notFound()

  const projects = await db.select({
    id: projectsTable.id, title: projectsTable.title, status: projectsTable.status, location_address: projectsTable.location_address,
  }).from(projectsTable)
    .where(and(eq(projectsTable.user_id, user.id), eq(projectsTable.client_id, id)))
    .orderBy(desc(projectsTable.created_at))

  const projectIds = projects.map(p => p.id)

  // Invoices for this client: single-project ones (by project_id) + combined ones (by client_id).
  const invoices = await db.query.invoices.findMany({
    columns: { id: true, invoice_number: true, status: true, total: true, amount_paid: true, currency: true, created_at: true, project_id: true },
    with: { invoice_line_items: { columns: { section_title: true }, orderBy: invoice_line_items.sort_order } },
    where: and(
      eq(invoicesTable.user_id, user.id),
      projectIds.length ? or(eq(invoicesTable.client_id, id), inArray(invoicesTable.project_id, projectIds)) : eq(invoicesTable.client_id, id),
    ),
    orderBy: desc(invoicesTable.created_at),
  })

  const c = client as Client
  const contactBits = [c.company, c.email, c.phone, c.country].filter(Boolean) as string[]
  const canCombine = (projects?.length ?? 0) >= 2

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/clients" className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">← Clients</Link>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">{c.name}</h1>
            {c.currency && (
              <span className="text-xs font-mono bg-[#f8f9fa] border border-[#e0e0e3] px-2 py-0.5 rounded-full text-[#5a5c62]">
                {c.currency}
              </span>
            )}
          </div>
          {contactBits.length > 0 && (
            <p className="text-sm text-[#5a5c62] mt-0.5">{contactBits.join(' · ')}</p>
          )}
        </div>
        <EditClientButton client={c} />
      </div>

      {c.address && (
        <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6">
          <p className="label-caps mb-1">Address</p>
          <p className="text-sm text-[#5a5c62]">{c.address}</p>
        </div>
      )}

      {/* Projects */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0e0e3]">
          <h2 className="label-caps">Projects</h2>
          <Link href="/projects" className="text-sm font-medium text-[#715a3e] hover:text-[#8b7355] transition-colors">
            + New Project
          </Link>
        </div>
        <div className="p-6">
          {(!projects || projects.length === 0) ? (
            <p className="text-sm text-[#8a8c94]">No projects yet for this client.</p>
          ) : (
            <div className="divide-y divide-[#f0f0f2]">
              {projects.map(p => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between py-3 hover:bg-[#f8f9fa] -mx-6 px-6 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-[#1a1c1e] truncate">{p.title}</span>
                    <StatusChip status={p.status} />
                  </div>
                  {p.location_address && (
                    <span className="text-xs text-[#8a8c94] truncate hidden sm:block">{p.location_address}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0e0e3]">
          <h2 className="label-caps">Invoices</h2>
          {canCombine && (
            <Link
              href={`/invoices/combined/new?clientId=${id}`}
              className="text-sm font-medium text-[#715a3e] hover:text-[#8b7355] transition-colors"
            >
              + Combined Invoice
            </Link>
          )}
        </div>
        <div className="p-6">
          {(!invoices || invoices.length === 0) ? (
            <p className="text-sm text-[#8a8c94]">No invoices yet for this client.</p>
          ) : (
            <div className="divide-y divide-[#f0f0f2]">
              {invoices.map((inv: { id: string; invoice_number: string; status: string; total: number; amount_paid: number; currency: string; project_id: string | null; invoice_line_items: { section_title: string | null }[] }) => {
                const owing = Number(inv.total) - Number(inv.amount_paid)
                const combinedProjects = inv.project_id === null
                  ? [...new Set((inv.invoice_line_items ?? []).map(li => li.section_title).filter(Boolean))] as string[]
                  : []
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between py-3 hover:bg-[#f8f9fa] -mx-6 px-6 transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium text-[#1a1c1e]">{inv.invoice_number}</span>
                        <StatusChip status={inv.status} />
                        {inv.project_id === null && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5ede4] border border-[#715a3e]/20 text-[#715a3e] font-medium">Combined</span>
                        )}
                      </div>
                      {combinedProjects.length > 0 && (
                        <p className="text-xs text-[#8a8c94] mt-0.5 truncate">{combinedProjects.join(' + ')}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm text-[#1a1c1e]">{fmtMoney(inv.total, inv.currency)}</p>
                      {owing > 0 && (
                        <p className="font-mono text-xs text-[#715a3e]">{fmtMoney(owing, inv.currency)} owing</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
