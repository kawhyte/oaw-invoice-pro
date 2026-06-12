import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ProjectNotes } from '@/components/projects/ProjectNotes'
import { ShareLinkPanel } from '@/components/projects/ShareLinkPanel'
import { FileUpload } from '@/components/projects/FileUpload'
import { FileList } from '@/components/projects/FileList'
import { ProjectDetailHeader } from './ProjectDetailHeader'
import type { ProjectFile } from '@/types'

const STATUS_STYLES = {
  discovery: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  complete: 'bg-green-100 text-green-700',
}
const STATUS_LABELS = {
  discovery: 'Discovery',
  in_progress: 'In Progress',
  review: 'Review',
  complete: 'Complete',
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: notes }, { data: files }, { data: allClients }] = await Promise.all([
    supabase.from('projects').select('*, clients(*)').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('project_notes').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('project_files').select('*').eq('project_id', id).order('uploaded_at', { ascending: false }),
    supabase.from('clients').select('*').order('name'),
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
          <Link href="/projects" className="text-sm text-gray-400 hover:text-gray-600">← Projects</Link>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[project.status as keyof typeof STATUS_STYLES]}`}>
              {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{(project.clients as any)?.name}</p>
        </div>
        <ProjectDetailHeader project={project as any} clients={allClients ?? []} />
      </div>

      {(project.description || project.location_address) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {project.description && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-gray-700">{project.description}</p>
            </div>
          )}
          {project.location_address && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Location</p>
              <p className="text-sm text-gray-700">{project.location_address}</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Files</h2>
          <FileUpload projectId={id} userId={user.id} />
        </div>
        <div className="p-6">
          <FileList projectId={id} files={filesWithUrls} />
        </div>
      </div>

      <ProjectNotes projectId={id} notes={notes ?? []} />
      <ShareLinkPanel projectId={id} shareToken={project.share_token} showFinancials={project.show_financials_on_share} />
    </div>
  )
}
