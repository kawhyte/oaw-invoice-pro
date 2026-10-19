'use server'
import { createClient } from '@/lib/supabase/server'
import { MAX_UPLOAD_BYTES } from '@/lib/uploadLimits'
import { signedPutUrl, removeObjects } from '@/lib/storage'
import { revalidatePath } from 'next/cache'

// Uploads go browser → object storage through presigned PUT URLs that only
// these actions issue (key chosen here, Content-Type + Content-Length signed).
// The file bytes never pass through the server; the save actions below re-check
// the namespace/type/size so a client can't register someone else's object.
function assertOwnedUploadPath(userId: string, projectId: string, path: string, ext: RegExp) {
  if (!path.startsWith(`${userId}/${projectId}/`)) throw new Error('Invalid storage path')
  if (!ext.test(path)) throw new Error('Unexpected file type')
}
function assertUploadSize(sizeBytes: number | null) {
  if (sizeBytes != null && (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES)) {
    throw new Error('File exceeds the maximum allowed size')
  }
}

/** Approves one PDF upload and returns where to PUT it. */
export async function createFileUploadAction(projectId: string, fileName: string, sizeBytes: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: project } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) throw new Error('Not found')
  assertUploadSize(sizeBytes)
  const safeName = fileName.replace(/[^\w.\- ]+/g, '_').replace(/\.pdf$/i, '') + '.pdf'
  const storagePath = `${user.id}/${projectId}/${Date.now()}-${safeName}`
  const url = await signedPutUrl(storagePath, 'application/pdf', sizeBytes)
  return { storagePath, url }
}

/** Approves a drawing upload: the original PDF + one preview and one zoom JPEG per page. */
export async function createDeliverableUploadAction(
  projectId: string,
  originalSize: number,
  pages: { previewSize: number; zoomSize: number }[],
) {
  const supabase = await assertProjectOwner(projectId)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  assertUploadSize(originalSize)
  if (pages.length === 0 || pages.length > 200) throw new Error('Unexpected page count')
  const JPEG_MAX = 15 * 1024 * 1024
  for (const p of pages) {
    if (p.previewSize <= 0 || p.previewSize > JPEG_MAX || p.zoomSize <= 0 || p.zoomSize > JPEG_MAX) {
      throw new Error('Preview image too large')
    }
  }
  const base = `${user.id}/${projectId}/deliverables/${crypto.randomUUID()}`
  const originalPath = `${base}/original.pdf`
  const original = { path: originalPath, url: await signedPutUrl(originalPath, 'application/pdf', originalSize) }
  const pageUrls = await Promise.all(pages.map(async (p, i) => {
    const previewPath = `${base}/page-${i + 1}.jpg`
    const zoomPath = `${base}/page-${i + 1}@zoom.jpg`
    return {
      previewPath, previewUrl: await signedPutUrl(previewPath, 'image/jpeg', p.previewSize),
      zoomPath, zoomUrl: await signedPutUrl(zoomPath, 'image/jpeg', p.zoomSize),
    }
  }))
  return { original, pages: pageUrls }
}

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
  assertOwnedUploadPath(user.id, projectId, storagePath, /\.pdf$/i)
  assertUploadSize(sizeBytes)
  const { error } = await supabase.from('project_files').insert({ project_id: projectId, name, storage_path: storagePath, size_bytes: sizeBytes })
  if (error) {
    // Don't leave an orphaned object eating the free storage allowance.
    await removeObjects([storagePath]).catch(() => {})
    throw new Error('The file uploaded but could not be saved to the project. Please try again.')
  }
  revalidatePath(`/projects/${projectId}`)
}

export async function toggleFileVisibilityAction(fileId: string, projectId: string, current: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // Verify the file belongs to a project owned by this user.
  const { data: file } = await supabase
    .from('project_files')
    .select('id, projects!inner(user_id)')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .single()
  if (!file || (file.projects as unknown as { user_id: string })?.user_id !== user.id) {
    throw new Error('Not found')
  }
  await supabase.from('project_files').update({ is_client_visible: !current }).eq('id', fileId)
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteFileAction(fileId: string, projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  // Verify ownership AND read the storage path from the row. Never trust a
  // caller-supplied path: the service-role client below bypasses Storage RLS.
  const { data: file } = await supabase
    .from('project_files')
    .select('id, storage_path, projects!inner(user_id)')
    .eq('id', fileId)
    .eq('project_id', projectId)
    .single()
  if (!file || (file.projects as unknown as { user_id: string })?.user_id !== user.id) {
    throw new Error('Not found')
  }
  await removeObjects([file.storage_path])
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  assertOwnedUploadPath(user.id, projectId, fields.storagePath, /\.pdf$/i)
  assertUploadSize(fields.sizeBytes)
  for (const p of [...fields.previewPaths, ...fields.zoomPaths]) {
    assertOwnedUploadPath(user.id, projectId, p, /\.jpg$/i)
  }
  const { error } = await supabase.from('project_deliverables').insert({
    project_id: projectId,
    name: fields.name,
    storage_path: fields.storagePath,
    preview_paths: fields.previewPaths,
    zoom_paths: fields.zoomPaths,
    page_count: fields.pageCount,
    size_bytes: fields.sizeBytes,
    linked_invoice_id: fields.linkedInvoiceId,
  })
  if (error) {
    // Don't leave the original + preview/zoom JPEGs orphaned in storage.
    await removeObjects([fields.storagePath, ...fields.previewPaths, ...fields.zoomPaths]).catch(() => {})
    throw new Error('The drawing uploaded but could not be saved to the project. Please try again.')
  }
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

  await removeObjects(paths)
  await supabase.from('project_deliverables').delete().eq('id', deliverableId).eq('project_id', projectId)
  revalidatePath(`/projects/${projectId}`)
}
