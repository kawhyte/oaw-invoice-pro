import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db, projects, project_notes, project_files, clients as clientsTable, invoices as invoicesTable, project_tasks, project_deliverables, business_settings, invoice_line_items } from '@/db'
import { requireUserPage } from '@/lib/session'
import { signedGetUrl } from '@/lib/storage'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ProjectNotes } from '@/components/projects/ProjectNotes'
import { ShareLinkPanel } from '@/components/projects/ShareLinkPanel'
import { FileUpload } from '@/components/projects/FileUpload'
import { FileList } from '@/components/projects/FileList'
import { DeliverableUpload } from '@/components/projects/DeliverableUpload'
import { DeliverableList, type DeliverableRow } from '@/components/projects/DeliverableList'
import { TaskChecklist } from '@/components/projects/TaskChecklist'
import { BudgetTracker } from '@/components/projects/BudgetTracker'
import { ProjectDetailHeader } from './ProjectDetailHeader'
import { StatusChip } from '@/components/ui/StatusChip'
import { VisibilityBadge } from '@/components/ui/VisibilityBadge'
import { isFinalUnlocked } from '@/lib/deliverables'
import type { Client, ProjectFile, ProjectDeliverable, ProjectNote, ProjectTask } from '@/types'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUserPage()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const origin = `${h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https')}://${host}`

  // Ownership is decided by the project row; child rows are only rendered if it exists.
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.user_id, user.id)),
    with: { clients: true },
  })
  if (!project) notFound()

  const invoiceCols = {
    id: invoicesTable.id, invoice_number: invoicesTable.invoice_number, status: invoicesTable.status, total: invoicesTable.total,
    amount_paid: invoicesTable.amount_paid, currency: invoicesTable.currency, created_at: invoicesTable.created_at, project_id: invoicesTable.project_id,
  }
  const [notes, files, allClients, invoices, tasks, deliverables, settings] = await Promise.all([
    db.select().from(project_notes).where(eq(project_notes.project_id, id)).orderBy(desc(project_notes.created_at)),
    db.select().from(project_files).where(eq(project_files.project_id, id)).orderBy(desc(project_files.uploaded_at)),
    db.select().from(clientsTable).where(eq(clientsTable.user_id, user.id)).orderBy(asc(clientsTable.name)),
    db.select(invoiceCols).from(invoicesTable)
      .where(and(eq(invoicesTable.project_id, id), eq(invoicesTable.user_id, user.id)))
      .orderBy(desc(invoicesTable.created_at)),
    db.select().from(project_tasks).where(eq(project_tasks.project_id, id)).orderBy(asc(project_tasks.sort_order)),
    db.select().from(project_deliverables).where(eq(project_deliverables.project_id, id)).orderBy(desc(project_deliverables.created_at)),
    db.query.business_settings.findFirst({ columns: { business_name: true }, where: eq(business_settings.user_id, user.id) }),
  ])

  // Personal projects are never billed — skip the combined-invoice lookup entirely.
  // Combined invoices touch this project via their line items (project_id is null on the invoice).
  const combinedLi = project.is_personal
    ? []
    : await db.select({ invoice_id: invoice_line_items.invoice_id }).from(invoice_line_items).where(eq(invoice_line_items.project_id, id))
  const combinedIds = [...new Set(combinedLi.map((r) => r.invoice_id))]
  const combinedInvoices = combinedIds.length
    ? await db.query.invoices.findMany({
        columns: { id: true, invoice_number: true, status: true, total: true, amount_paid: true, currency: true, created_at: true, project_id: true },
        with: { invoice_line_items: { columns: { section_title: true }, orderBy: invoice_line_items.sort_order } },
        where: and(eq(invoicesTable.user_id, user.id), inArray(invoicesTable.id, combinedIds), isNull(invoicesTable.project_id)),
        orderBy: desc(invoicesTable.created_at),
      })
    : []
  const allInvoices = [...(invoices ?? []), ...(combinedInvoices ?? [])]

  const filesWithUrls = await Promise.all(
    (files as ProjectFile[]).map(async (file) => ({ ...file, signedUrl: await signedGetUrl(file.storage_path, 3600) }))
  )

  // Resolve each deliverable's lock state against its linked invoice.
  const invoiceById = new Map(allInvoices.map((inv: any) => [inv.id, inv]))
  const deliverableRows: DeliverableRow[] = (deliverables ?? []).map((d: ProjectDeliverable) => {
    const inv = d.linked_invoice_id ? invoiceById.get(d.linked_invoice_id) : null
    const invoicePaid = inv ? (inv.status === 'paid' || Number(inv.amount_paid ?? 0) >= Number(inv.total)) : false
    const unlocked = isFinalUnlocked(d, inv)
    let gateLabel: string
    let warn = false
    if (d.manual_unlock && !invoicePaid) {
      // Force-shared before full payment — flag it so he remembers he's still owed.
      gateLabel = inv ? `Force-shared — ${inv.invoice_number} not paid in full` : 'Force-shared — no invoice linked'
      warn = !!inv
    } else if (unlocked) {
      gateLabel = inv ? `Unlocked — ${inv.invoice_number} paid` : 'Released to client manually'
    } else if (inv) {
      gateLabel = `Locked — unlocks when ${inv.invoice_number} is paid`
    } else {
      gateLabel = 'Locked — release manually to share'
    }
    return { id: d.id, name: d.name, page_count: d.page_count, manual_unlock: d.manual_unlock, unlocked, gateLabel, warn }
  })
  const deliverableInvoiceOptions = allInvoices.map((inv: any) => ({ id: inv.id, invoice_number: inv.invoice_number, status: inv.status }))
  const watermarkText = `DRAFT · ${settings?.business_name || 'OW Studio'} · NOT FOR PRINT`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/projects" className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">← Projects</Link>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">{project.title}</h1>
            <StatusChip status={project.status} />
          </div>
          <p className="text-sm text-[#5a5c62] mt-0.5">
            {project.is_personal ? 'Personal project' : (project.clients as any)?.name}
          </p>
        </div>
        <ProjectDetailHeader project={project as any} clients={allClients as Client[]} />
      </div>

      {(project.description || project.location_address) && (
        <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {project.description && (
            <div>
              <p className="label-caps mb-1">Description</p>
              <p className="text-sm text-[#5a5c62]">{project.description}</p>
            </div>
          )}
          {project.location_address && (
            <div>
              <p className="label-caps mb-1">Location</p>
              <p className="text-sm text-[#5a5c62]">{project.location_address}</p>
            </div>
          )}
        </div>
      )}

      {project.is_personal && <BudgetTracker budget={project.budget} tasks={tasks as ProjectTask[]} />}

      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
        <div className="flex flex-col gap-3 px-6 py-4 border-b border-gray-100 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="label-caps">Documents</h2>
              {!project.is_personal && <VisibilityBadge variant="shared" />}
            </div>
            {!project.is_personal && (
              <p className="text-xs text-[#8a8c94] mt-1">e.g. signed contract, permit, site survey, or the invoice PDF. Shared on the client link below — PDF only; use the switch on a file to keep one private.</p>
            )}
          </div>
          <FileUpload projectId={id} userId={user.id} />
        </div>
        <div className="p-6">
          <FileList projectId={id} files={filesWithUrls} showVisibility={!project.is_personal} />
        </div>
      </div>

      {!project.is_personal && (
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
        <div className="flex flex-col gap-3 px-6 py-4 border-b border-gray-100 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="label-caps">Drawings</h2>
              <VisibilityBadge variant="gated" />
            </div>
            <p className="text-xs text-[#8a8c94] mt-1">Clients review a watermarked draft; the print-ready file unlocks when the linked invoice is paid (or you release it). Accepts PDF files only.</p>
          </div>
          <DeliverableUpload projectId={id} userId={user.id} invoices={deliverableInvoiceOptions} watermarkText={watermarkText} />
        </div>
        <div className="p-6">
          <DeliverableList projectId={id} deliverables={deliverableRows} />
        </div>
      </div>
      )}

      {!project.is_personal && (
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
        <div className="flex flex-col gap-3 px-6 py-4 border-b border-[#e0e0e3] sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="label-caps">Invoices</h2>
              <VisibilityBadge variant="private" />
            </div>
            <p className="text-xs text-[#8a8c94] mt-1">Just for you. Share a payment summary with the toggle in Client Share Link; saved invoice PDFs appear under Documents.</p>
          </div>
          <Link
            href={`/invoices/new?projectId=${id}`}
            className="text-sm font-medium text-[#715a3e] hover:text-[#8b7355] transition-colors shrink-0"
          >
            + New Invoice
          </Link>
        </div>
        <div className="p-6">
          {allInvoices.length === 0 ? (
            <p className="text-sm text-[#8a8c94]">No invoices yet.</p>
          ) : (
            <div className="space-y-0 divide-y divide-[#f0f0f2]">
              {allInvoices.map((inv: any) => {
                const owing = Number(inv.total) - Number(inv.amount_paid)
                const fmt = (n: number) =>
                  `${inv.currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                const otherProjects = inv.project_id === null
                  ? ([...new Set((inv.invoice_line_items ?? []).map((li: any) => li.section_title).filter(Boolean))] as string[])
                      .filter(t => t !== project.title)
                  : []
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between py-3 hover:bg-[#f8f9fa] -mx-6 px-6 transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium text-[#1a1c1e]">
                          {inv.invoice_number}
                        </span>
                        <StatusChip status={inv.status} />
                        {inv.project_id === null && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5ede4] border border-[#715a3e]/20 text-[#715a3e] font-medium">
                            Combined
                          </span>
                        )}
                      </div>
                      {inv.project_id === null && (
                        <p className="text-xs text-[#8a8c94] mt-0.5 truncate">
                          {otherProjects.length > 0 ? `With ${otherProjects.join(' + ')}` : 'Billed with other projects'}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm text-[#1a1c1e]">{fmt(inv.total)}</p>
                      {owing > 0 && (
                        <p className="font-mono text-xs text-[#715a3e]">{fmt(owing)} owing</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
      )}

      <TaskChecklist projectId={id} tasks={tasks as ProjectTask[]} />

      <ProjectNotes projectId={id} notes={notes as ProjectNote[]} showClientBadge={!project.is_personal} />
      {!project.is_personal && (
        <ShareLinkPanel origin={origin} projectId={id} shareToken={project.share_token} showFinancials={project.show_financials_on_share ?? false} fileCount={filesWithUrls.filter(f => f.is_client_visible).length} deliverableCount={deliverables?.length ?? 0} noteCount={notes?.length ?? 0} invoiceCount={invoices?.length ?? 0} projectTitle={project.title} clientName={(project.clients as Pick<Client, 'name' | 'phone'> | null)?.name ?? null} clientPhone={(project.clients as Pick<Client, 'name' | 'phone'> | null)?.phone ?? null} />
      )}
    </div>
  )
}
