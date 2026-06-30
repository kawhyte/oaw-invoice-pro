import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound, redirect } from 'next/navigation'
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
import { isFinalUnlocked } from '@/lib/deliverables'
import { Eye, Lock } from 'lucide-react'
import type { ProjectFile, ProjectDeliverable } from '@/types'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: notes }, { data: files }, { data: allClients }, { data: invoices }, { data: tasks }, { data: deliverables }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*, clients(*)').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('project_notes').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('project_files').select('*').eq('project_id', id).order('uploaded_at', { ascending: false }),
    supabase.from('clients').select('*').order('name'),
    supabase.from('invoices').select('id, invoice_number, status, total, amount_paid, currency, created_at, project_id').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('project_tasks').select('*').eq('project_id', id).order('sort_order', { ascending: true }),
    supabase.from('project_deliverables').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('business_settings').select('business_name').eq('user_id', user.id).maybeSingle(),
  ])

  if (!project) notFound()

  // Personal projects are never billed — skip the combined-invoice lookup entirely.
  // Combined invoices touch this project via their line items (project_id is null on the invoice).
  const { data: combinedLi } = project.is_personal
    ? { data: [] as { invoice_id: string }[] }
    : await supabase.from('invoice_line_items').select('invoice_id').eq('project_id', id)
  const combinedIds = [...new Set((combinedLi ?? []).map((r: { invoice_id: string }) => r.invoice_id))]
  const { data: combinedInvoices } = combinedIds.length
    ? await supabase
        .from('invoices')
        .select('id, invoice_number, status, total, amount_paid, currency, created_at, project_id, invoice_line_items(section_title)')
        .eq('user_id', user.id)
        .in('id', combinedIds)
        .is('project_id', null)
        .order('created_at', { ascending: false })
    : { data: [] }
  const allInvoices = [...(invoices ?? []), ...(combinedInvoices ?? [])]

  const service = createServiceClient()
  const filesWithUrls = await Promise.all(
    (files ?? []).map(async (file: ProjectFile) => {
      const { data } = await service.storage.from('project-files').createSignedUrl(file.storage_path, 3600)
      return { ...file, signedUrl: data?.signedUrl ?? '' }
    })
  )

  // Resolve each deliverable's lock state against its linked invoice.
  const invoiceById = new Map(allInvoices.map((inv: any) => [inv.id, inv]))
  const deliverableRows: DeliverableRow[] = (deliverables ?? []).map((d: ProjectDeliverable) => {
    const inv = d.linked_invoice_id ? invoiceById.get(d.linked_invoice_id) : null
    const unlocked = isFinalUnlocked(d, inv)
    let gateLabel: string
    if (unlocked) {
      gateLabel = d.manual_unlock ? 'Released to client manually' : `Unlocked — ${inv?.invoice_number} paid`
    } else if (inv) {
      gateLabel = `Locked — unlocks when ${inv.invoice_number} is paid`
    } else {
      gateLabel = 'Locked — release manually to share'
    }
    return { id: d.id, name: d.name, page_count: d.page_count, manual_unlock: d.manual_unlock, unlocked, gateLabel }
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
        <ProjectDetailHeader project={project as any} clients={allClients ?? []} />
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

      {project.is_personal && <BudgetTracker budget={project.budget} tasks={tasks ?? []} />}

      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
        <div className="flex flex-col gap-3 px-6 py-4 border-b border-gray-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="label-caps">Files</h2>
            {!project.is_personal && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-emerald-700 bg-emerald-50 border border-emerald-200">
                <Eye className="w-3 h-3" />
                Always visible to client
              </span>
            )}
          </div>
          <FileUpload projectId={id} userId={user.id} />
        </div>
        <div className="p-6">
          <FileList projectId={id} files={filesWithUrls} />
        </div>
      </div>

      {!project.is_personal && (
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
        <div className="flex flex-col gap-3 px-6 py-4 border-b border-gray-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="label-caps">Client Deliverables</h2>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-amber-700 bg-amber-50 border border-amber-200">
              <Lock className="w-3 h-3" />
              Draft preview now · final unlocks on payment
            </span>
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0e0e3]">
          <h2 className="label-caps">Invoices</h2>
          <Link
            href={`/invoices/new?projectId=${id}`}
            className="text-sm font-medium text-[#715a3e] hover:text-[#8b7355] transition-colors"
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

      <TaskChecklist projectId={id} tasks={tasks ?? []} />

      <ProjectNotes projectId={id} notes={notes ?? []} showClientBadge={!project.is_personal} />
      {!project.is_personal && (
        <ShareLinkPanel projectId={id} shareToken={project.share_token} showFinancials={project.show_financials_on_share} fileCount={filesWithUrls.length} noteCount={notes?.length ?? 0} invoiceCount={invoices?.length ?? 0} />
      )}
    </div>
  )
}
