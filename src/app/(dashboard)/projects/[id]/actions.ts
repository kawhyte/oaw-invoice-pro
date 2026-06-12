'use server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

export async function addNoteAction(projectId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) throw new Error('Not found')
  await supabase.from('project_notes').insert({ project_id: projectId, content })
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteNoteAction(noteId: string, projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('project_notes').delete().eq('id', noteId)
  revalidatePath(`/projects/${projectId}`)
}

export async function rotateShareTokenAction(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('projects').update({ share_token: crypto.randomUUID() }).eq('id', projectId).eq('user_id', user.id)
  revalidatePath(`/projects/${projectId}`)
}

export async function toggleFinancialsAction(projectId: string, current: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('projects').update({ show_financials_on_share: !current }).eq('id', projectId).eq('user_id', user.id)
  revalidatePath(`/projects/${projectId}`)
}

export async function saveFileMetaAction(projectId: string, name: string, storagePath: string, sizeBytes: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('project_files').insert({ project_id: projectId, name, storage_path: storagePath, size_bytes: sizeBytes })
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteFileAction(fileId: string, storagePath: string, projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const service = createServiceClient()
  await service.storage.from('project-files').remove([storagePath])
  await supabase.from('project_files').delete().eq('id', fileId)
  revalidatePath(`/projects/${projectId}`)
}
