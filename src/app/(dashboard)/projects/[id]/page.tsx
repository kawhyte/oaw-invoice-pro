import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ProjectNotes } from '@/components/projects/ProjectNotes'
import { ShareLinkPanel } from '@/components/projects/ShareLinkPanel'
import { FileUpload } from '@/components/projects/FileUpload'
import { FileList } from '@/components/projects/FileList'
import { ProjectDetailHeader } from './ProjectDetailHeader'
import { StatusChip } from '@/components/ui/StatusChip'
import { Eye } from 'lucide-react'
import type { ProjectFile } from '@/types'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: notes }, { data: files }, { data: allClients }, { data: invoices }] = await Promise.all([
    supabase.from('projects').select('*, clients(*)').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('project_notes').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('project_files').select('*').eq('project_id', id).order('uploaded_at', { ascending: false }),
    supabase.from('clients').select('*').order('name'),
    supabase.from('invoices').select('id, invoice_number, status, total, amount_paid, currency, created_at').eq('project_id', id).order('created_at', { ascending: false }),
  ])

  if (!project) notFound()

  const service = createServiceClient()
  const filesWithUrls = await Promise.all(
    (files ?? []).map(async (file: ProjectFile) => {
      const { data } = await service.storage.from('project-files').createSignedUrl(file.storage_path, 3600)
      return { ...file, signedUrl: data?.signedUrl ?? '' }
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/projects" className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">← Projects</Link>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">{project.title}</h1>
            <StatusChip status={project.status} />
          </div>
          <p className="text-sm text-[#5a5c62] mt-0.5">{(project.clients as any)?.name}</p>
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

      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="label-caps">Files</h2>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-emerald-700 bg-emerald-50 border border-emerald-200">
              <Eye className="w-3 h-3" />
              Always visible to client
            </span>
          </div>
          <FileUpload projectId={id} userId={user.id} />
        </div>
        <div className="p-6">
          <FileList projectId={id} files={filesWithUrls} />
        </div>
      </div>

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
          {(!invoices || invoices.length === 0) ? (
            <p className="text-sm text-[#8a8c94]">No invoices yet.</p>
          ) : (
            <div className="space-y-0 divide-y divide-[#f0f0f2]">
              {invoices.map((inv: any) => {
                const owing = Number(inv.total) - Number(inv.amount_paid)
                const fmt = (n: number) =>
                  `${inv.currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between py-3 hover:bg-[#f8f9fa] -mx-6 px-6 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium text-[#1a1c1e]">
                        {inv.invoice_number}
                      </span>
                      <StatusChip status={inv.status} />
                    </div>
                    <div className="text-right">
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

      <ProjectNotes projectId={id} notes={notes ?? []} />
      <ShareLinkPanel projectId={id} shareToken={project.share_token} showFinancials={project.show_financials_on_share} fileCount={filesWithUrls.length} noteCount={notes?.length ?? 0} invoiceCount={invoices?.length ?? 0} />
    </div>
  )
}
