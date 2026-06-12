import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { StatusChip } from '@/components/ui/StatusChip'
import type { ProjectFile, ProjectNote } from '@/types'

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const service = createServiceClient()

  const { data: project } = await service
    .from('projects')
    .select('*, clients(*)')
    .eq('share_token', token)
    .single()

  if (!project) notFound()

  const [{ data: notes }, { data: files }, { data: invoices }] = await Promise.all([
    service.from('project_notes').select('*').eq('project_id', project.id).order('created_at', { ascending: true }),
    service.from('project_files').select('*').eq('project_id', project.id).order('uploaded_at', { ascending: false }),
    service.from('invoices').select('*, invoice_payments(*)').eq('project_id', project.id).order('created_at', { ascending: false }),
  ])

  const filesWithUrls = await Promise.all(
    (files ?? []).map(async (file: ProjectFile) => {
      const { data } = await service.storage.from('project-files').createSignedUrl(file.storage_path, 86400)
      return { ...file, signedUrl: data?.signedUrl ?? '' }
    })
  )

  const client = project.clients as any

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#1a1c1e]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-semibold text-white text-sm">OAW Invoice Pro</span>
          <StatusChip status={project.status} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1c1e]">{project.title}</h1>
          {client && <p className="text-[#5a5c62] text-sm mt-1">Prepared for {client.name}</p>}
          {project.description && <p className="text-[#5a5c62] text-sm mt-3">{project.description}</p>}
        </div>

        {/* Files */}
        <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="label-caps">Documents</h2>
          </div>
          <div className="p-6">
            {filesWithUrls.length === 0 ? (
              <p className="text-sm text-[#8a8c94]">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {filesWithUrls.map(file => (
                  <div key={file.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-red-500 shrink-0">📄</span>
                      <span className="text-sm text-[#5a5c62] truncate">{file.name}</span>
                    </div>
                    <a href={file.signedUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-[#715a3e] hover:text-[#8b7355] shrink-0 ml-4 font-medium">
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Progress Notes */}
        {(notes ?? []).length > 0 && (
          <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="label-caps">Project Updates</h2>
            </div>
            <div className="p-6 space-y-4">
              {(notes as ProjectNote[]).map(note => (
                <div key={note.id} className="border-l-2 border-[#715a3e]/30 pl-4">
                  <p className="text-sm text-[#5a5c62] whitespace-pre-wrap">{note.content}</p>
                  <p className="text-xs text-[#8a8c94] mt-1">
                    {new Date(note.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Summary */}
        {project.show_financials_on_share && (invoices ?? []).length > 0 && (
          <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="label-caps">Payment Summary</h2>
            </div>
            <div className="p-6 space-y-4">
              {(invoices ?? []).map((inv: any) => {
                const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency }).format(n)
                const STATUS: Record<string, string> = { unpaid: 'Unpaid', partial: 'Partially Paid', paid: 'Paid', overdue: 'Overdue' }
                return (
                  <div key={inv.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-[#5a5c62]">{inv.invoice_number}</span>
                      <span className="text-[#8a8c94]">{STATUS[inv.status]}</span>
                    </div>
                    {(inv.invoice_payments ?? []).map((p: any) => (
                      <div key={p.id} className="flex justify-between text-sm text-[#5a5c62] pl-3">
                        <span>{p.label}</span>
                        <span className={p.status === 'paid' ? 'text-[#2a5130]' : ''}>
                          {fmt(p.amount)} {p.status === 'paid' ? '✓' : ''}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold text-[#1a1c1e] pt-1 border-t border-[#e0e0e3]">
                      <span>Total</span>
                      <span>{fmt(inv.total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-4 py-8 text-center text-xs text-[#8a8c94]">
        This is a secure project link shared by OAW Invoice Pro
      </footer>
    </div>
  )
}
