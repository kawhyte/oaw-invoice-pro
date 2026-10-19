'use server'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, projects, project_notes, project_tasks, project_files, project_deliverables, invoices } from '@/db'
import { requireUser } from '@/lib/session'
import { MAX_UPLOAD_BYTES } from '@/lib/uploadLimits'
import { signedPutUrl, removeObjects } from '@/lib/storage'

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

/** Signed-in owner of `projectId`, or throws. Every action below goes through this. */
async function assertProjectOwner(projectId: string) {
  const user = await requireUser()
  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.user_id, user.id))).limit(1)
  if (!project) throw new Error('Not found')
  return user
}

/** Approves one PDF upload and returns where to PUT it. */
export async function createFileUploadAction(projectId: string, fileName: string, sizeBytes: number) {
  const user = await assertProjectOwner(projectId)
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
  const user = await assertProjectOwner(projectId)
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
  await assertProjectOwner(projectId)
  await db.insert(project_notes).values({ project_id: projectId, content })
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteNoteAction(noteId: string, projectId: string) {
  await assertProjectOwner(projectId)
  await db.delete(project_notes).where(and(eq(project_notes.id, noteId), eq(project_notes.project_id, projectId)))
  revalidatePath(`/projects/${projectId}`)
}

// ---- Checklist tasks (available on all projects) ---------------------------

export async function addTaskAction(
  projectId: string,
  fields: { title: string; cost: number | null; due_date: string | null }
) {
  await assertProjectOwner(projectId)
  // New tasks sort to the bottom of the open list.
  const [last] = await db.select({ sort_order: project_tasks.sort_order }).from(project_tasks)
    .where(eq(project_tasks.project_id, projectId)).orderBy(desc(project_tasks.sort_order)).limit(1)
  await db.insert(project_tasks).values({
    project_id: projectId,
    title: fields.title,
    cost: fields.cost,
    due_date: fields.due_date,
    sort_order: (last?.sort_order ?? 0) + 1,
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function toggleTaskAction(projectId: string, taskId: string, completed: boolean) {
  await assertProjectOwner(projectId)
  await db.update(project_tasks).set({ completed })
    .where(and(eq(project_tasks.id, taskId), eq(project_tasks.project_id, projectId)))
  revalidatePath(`/projects/${projectId}`)
}

export async function updateTaskAction(
  projectId: string,
  taskId: string,
  fields: { title: string; cost: number | null; due_date: string | null }
) {
  await assertProjectOwner(projectId)
  await db.update(project_tasks).set({ title: fields.title, cost: fields.cost, due_date: fields.due_date })
    .where(and(eq(project_tasks.id, taskId), eq(project_tasks.project_id, projectId)))
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteTaskAction(projectId: string, taskId: string) {
  await assertProjectOwner(projectId)
  await db.delete(project_tasks).where(and(eq(project_tasks.id, taskId), eq(project_tasks.project_id, projectId)))
  revalidatePath(`/projects/${projectId}`)
}

export async function rotateShareTokenAction(projectId: string) {
  await assertProjectOwner(projectId)
  await db.update(projects).set({ share_token: crypto.randomUUID() }).where(eq(projects.id, projectId))
  revalidatePath(`/projects/${projectId}`)
}

export async function toggleFinancialsAction(projectId: string, current: boolean) {
  await assertProjectOwner(projectId)
  await db.update(projects).set({ show_financials_on_share: !current }).where(eq(projects.id, projectId))
  revalidatePath(`/projects/${projectId}`)
}

export async function saveFileMetaAction(projectId: string, name: string, storagePath: string, sizeBytes: number) {
  const user = await assertProjectOwner(projectId)
  assertOwnedUploadPath(user.id, projectId, storagePath, /\.pdf$/i)
  assertUploadSize(sizeBytes)
  try {
    await db.insert(project_files).values({ project_id: projectId, name, storage_path: storagePath, size_bytes: sizeBytes })
  } catch {
    // Don't leave an orphaned object eating the free storage allowance.
    await removeObjects([storagePath]).catch(() => {})
    throw new Error('The file uploaded but could not be saved to the project. Please try again.')
  }
  revalidatePath(`/projects/${projectId}`)
}

export async function toggleFileVisibilityAction(fileId: string, projectId: string, current: boolean) {
  await assertProjectOwner(projectId)
  await db.update(project_files).set({ is_client_visible: !current })
    .where(and(eq(project_files.id, fileId), eq(project_files.project_id, projectId)))
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteFileAction(fileId: string, projectId: string) {
  await assertProjectOwner(projectId)
  // Read the storage path from the owned row — never trust a caller-supplied path.
  const [file] = await db.select({ storage_path: project_files.storage_path }).from(project_files)
    .where(and(eq(project_files.id, fileId), eq(project_files.project_id, projectId))).limit(1)
  if (!file) throw new Error('Not found')
  await removeObjects([file.storage_path])
  await db.delete(project_files).where(eq(project_files.id, fileId))
  revalidatePath(`/projects/${projectId}`)
}

// ---- Client deliverables (payment-gated draft/final drawings) ---------------

async function assertOwnInvoice(userId: string, invoiceId: string | null) {
  if (!invoiceId) return
  const [inv] = await db.select({ id: invoices.id }).from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.user_id, userId))).limit(1)
  if (!inv) throw new Error('Invoice not found')
}

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
  const user = await assertProjectOwner(projectId)
  assertOwnedUploadPath(user.id, projectId, fields.storagePath, /\.pdf$/i)
  assertUploadSize(fields.sizeBytes)
  for (const p of [...fields.previewPaths, ...fields.zoomPaths]) {
    assertOwnedUploadPath(user.id, projectId, p, /\.jpg$/i)
  }
  await assertOwnInvoice(user.id, fields.linkedInvoiceId)
  try {
    await db.insert(project_deliverables).values({
      project_id: projectId,
      name: fields.name,
      storage_path: fields.storagePath,
      preview_paths: fields.previewPaths,
      zoom_paths: fields.zoomPaths,
      page_count: fields.pageCount,
      size_bytes: fields.sizeBytes,
      linked_invoice_id: fields.linkedInvoiceId,
    })
  } catch {
    // Don't leave the original + preview/zoom JPEGs orphaned in storage.
    await removeObjects([fields.storagePath, ...fields.previewPaths, ...fields.zoomPaths]).catch(() => {})
    throw new Error('The drawing uploaded but could not be saved to the project. Please try again.')
  }
  revalidatePath(`/projects/${projectId}`)
}

export async function toggleDeliverableUnlockAction(deliverableId: string, projectId: string, current: boolean) {
  await assertProjectOwner(projectId)
  await db.update(project_deliverables).set({ manual_unlock: !current })
    .where(and(eq(project_deliverables.id, deliverableId), eq(project_deliverables.project_id, projectId)))
  revalidatePath(`/projects/${projectId}`)
}

export async function updateDeliverableInvoiceLinkAction(deliverableId: string, projectId: string, invoiceId: string | null) {
  const user = await assertProjectOwner(projectId)
  await assertOwnInvoice(user.id, invoiceId)
  await db.update(project_deliverables).set({ linked_invoice_id: invoiceId })
    .where(and(eq(project_deliverables.id, deliverableId), eq(project_deliverables.project_id, projectId)))
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteDeliverableAction(deliverableId: string, projectId: string) {
  await assertProjectOwner(projectId)
  // Pull the storage paths (original + previews + zoom) before deleting the row.
  const [deliverable] = await db.select({
    storage_path: project_deliverables.storage_path,
    preview_paths: project_deliverables.preview_paths,
    zoom_paths: project_deliverables.zoom_paths,
  }).from(project_deliverables)
    .where(and(eq(project_deliverables.id, deliverableId), eq(project_deliverables.project_id, projectId))).limit(1)
  if (!deliverable) throw new Error('Not found')

  const asPaths = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : [])
  const paths = [
    deliverable.storage_path,
    ...asPaths(deliverable.preview_paths),
    ...asPaths(deliverable.zoom_paths),
  ].filter(Boolean)

  await removeObjects(paths)
  await db.delete(project_deliverables).where(eq(project_deliverables.id, deliverableId))
  revalidatePath(`/projects/${projectId}`)
}
