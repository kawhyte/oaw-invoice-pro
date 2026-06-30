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
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) throw new Error('Not found')
  await supabase.from('project_notes').delete().eq('id', noteId).eq('project_id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

// ---- Checklist tasks (available on all projects) ---------------------------

async function assertProjectOwner(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) throw new Error('Not found')
  return supabase
}

export async function addTaskAction(
  projectId: string,
  fields: { title: string; cost: number | null; due_date: string | null }
) {
  const supabase = await assertProjectOwner(projectId)
  // New tasks sort to the bottom of the open list.
  const { data: last } = await supabase
    .from('project_tasks')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  await supabase.from('project_tasks').insert({
    project_id: projectId,
    title: fields.title,
    cost: fields.cost,
    due_date: fields.due_date,
    sort_order: (last?.sort_order ?? 0) + 1,
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function toggleTaskAction(projectId: string, taskId: string, completed: boolean) {
  const supabase = await assertProjectOwner(projectId)
  await supabase.from('project_tasks').update({ completed }).eq('id', taskId).eq('project_id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateTaskAction(
  projectId: string,
  taskId: string,
  fields: { title: string; cost: number | null; due_date: string | null }
) {
  const supabase = await assertProjectOwner(projectId)
  await supabase
    .from('project_tasks')
    .update({ title: fields.title, cost: fields.cost, due_date: fields.due_date })
    .eq('id', taskId)
    .eq('project_id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteTaskAction(projectId: string, taskId: string) {
  const supabase = await assertProjectOwner(projectId)
  await supabase.from('project_tasks').delete().eq('id', taskId).eq('project_id', projectId)
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
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) throw new Error('Not found')
  await supabase.from('project_files').insert({ project_id: projectId, name, storage_path: storagePath, size_bytes: sizeBytes })
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteFileAction(fileId: string, storagePath: string, projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // Verify the file belongs to a project owned by this user before touching storage/db.
  const { data: file } = await supabase
    .from('project_files')
    .select('id, projects!inner(user_id)')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .single()
  if (!file || (file.projects as unknown as { user_id: string })?.user_id !== user.id) {
    throw new Error('Not found')
  }
  const service = createServiceClient()
  await service.storage.from('project-files').remove([storagePath])
  await supabase.from('project_files').delete().eq('id', fileId)
  revalidatePath(`/projects/${projectId}`)
}

// ---- Client deliverables (payment-gated draft/final drawings) ---------------

export async function saveDeliverableAction(
  projectId: string,
  fields: {
    name: string
    storagePath: string
    previewPaths: string[]
    zoomPaths: string[]
    pageCount: number | null
    sizeBytes: number | null
    linkedInvoiceId: string | null
  }
) {
  const supabase = await assertProjectOwner(projectId)
  await supabase.from('project_deliverables').insert({
    project_id: projectId,
    name: fields.name,
    storage_path: fields.storagePath,
    preview_paths: fields.previewPaths,
    zoom_paths: fields.zoomPaths,
    page_count: fields.pageCount,
    size_bytes: fields.sizeBytes,
    linked_invoice_id: fields.linkedInvoiceId,
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function toggleDeliverableUnlockAction(
  deliverableId: string,
  projectId: string,
  current: boolean
) {
  const supabase = await assertProjectOwner(projectId)
  await supabase
    .from('project_deliverables')
    .update({ manual_unlock: !current })
    .eq('id', deliverableId)
    .eq('project_id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateDeliverableInvoiceLinkAction(
  deliverableId: string,
  projectId: string,
  invoiceId: string | null
) {
  const supabase = await assertProjectOwner(projectId)
  await supabase
    .from('project_deliverables')
    .update({ linked_invoice_id: invoiceId })
    .eq('id', deliverableId)
    .eq('project_id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteDeliverableAction(deliverableId: string, projectId: string) {
  const supabase = await assertProjectOwner(projectId)
  // Pull the storage paths (original + previews + zoom) before deleting the row.
  const { data: deliverable } = await supabase
    .from('project_deliverables')
    .select('storage_path, preview_paths, zoom_paths')
    .eq('id', deliverableId)
    .eq('project_id', projectId)
    .single()
  if (!deliverable) throw new Error('Not found')

  const asPaths = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])
  const paths = [
    deliverable.storage_path,
    ...asPaths(deliverable.preview_paths),
    ...asPaths(deliverable.zoom_paths),
  ].filter(Boolean)

  const service = createServiceClient()
  if (paths.length) await service.storage.from('project-files').remove(paths)
  await supabase.from('project_deliverables').delete().eq('id', deliverableId).eq('project_id', projectId)
  revalidatePath(`/projects/${projectId}`)
}
