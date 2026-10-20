'use server'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  db, clients, projects, project_deliverables,
  proposals, proposal_line_items, proposal_versions, proposal_drawings,
} from '@/db'
import { requireUser } from '@/lib/session'
import { signedPutUrl, removeObjects } from '@/lib/storage'
import { MAX_UPLOAD_BYTES } from '@/lib/uploadLimits'
import { geocodeAddress } from '@/lib/geocode'
import { computeTotals, lineSubtotal, round2 } from '@/lib/invoiceCalc'
import { isDateString, todayInBusinessTz } from '@/lib/dates'
import {
  buildSnapshot, effectiveStatus, invoiceDescription, isCategory, isEditable, snapshotsEqual,
} from '@/lib/proposals'
import {
  insertInvoiceWithUniqueNumber, insertLineItems, insertProposalWithUniqueNumber, type Exec,
} from '@/lib/invoiceNumbering'
import type { DiscountType, ProposalItemCategory } from '@/types'

// Owner-only proposal actions. Every action starts with requireUser() and
// scopes every proposal query by user_id (there is no RLS). Child rows
// (items/versions/drawings) are only touched after the parent ownership check.

type ItemInput = { category: ProposalItemCategory | null; description: string; quantity: number; unit_price: number }

const str = (fd: FormData, k: string, max: number): string | null => {
  const v = ((fd.get(k) as string | null) ?? '').trim()
  if (v.length > max) throw new Error(`${k.replace(/_/g, ' ')} is too long`)
  return v || null
}
const num = (fd: FormData, k: string): number => {
  const n = parseFloat(fd.get(k) as string)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Validates the create/edit form. Recipient comes from an owned client or the typed prospect fields. */
async function parseProposalForm(fd: FormData, userId: string) {
  const title = str(fd, 'title', 200)
  if (!title) throw new Error('Give the proposal a title')

  const validUntil = fd.get('valid_until') as string
  if (!isDateString(validUntil)) throw new Error('Pick a valid “valid until” date')
  if (validUntil < todayInBusinessTz()) throw new Error('“Valid until” can’t be in the past')

  const currency = fd.get('currency') === 'USD' ? 'USD' : 'JMD'
  const dt = fd.get('discount_type') as string
  const discountType: DiscountType = dt === 'percentage' || dt === 'fixed' ? dt : 'none'

  let rawItems: unknown
  try { rawItems = JSON.parse((fd.get('line_items') as string) || '[]') } catch { throw new Error('Invalid line items') }
  if (!Array.isArray(rawItems)) throw new Error('Invalid line items')
  const items: ItemInput[] = rawItems
    .map((i: Record<string, unknown>) => ({
      category: isCategory(i?.category) ? i.category : null,
      description: String(i?.description ?? '').trim(),
      quantity: Number(i?.quantity),
      unit_price: Number(i?.unit_price),
    }))
    .filter(i => i.description)
  if (items.length === 0) throw new Error('Add at least one line item')
  if (items.length > 100) throw new Error('Too many line items')
  for (const i of items) {
    if (i.description.length > 500) throw new Error('A line item description is too long')
    if (!Number.isFinite(i.quantity) || i.quantity <= 0) throw new Error(`Quantity must be more than 0 (“${i.description}”)`)
    if (!Number.isFinite(i.unit_price) || i.unit_price < 0) throw new Error(`Price can’t be negative (“${i.description}”)`)
  }

  let clientId = (fd.get('client_id') as string) || null
  let recipientName = str(fd, 'recipient_name', 200)
  let recipientPhone = str(fd, 'recipient_phone', 50)
  let recipientEmail = str(fd, 'recipient_email', 200)
  if (clientId) {
    const [c] = await db.select({ id: clients.id, name: clients.name, phone: clients.phone, email: clients.email })
      .from(clients).where(and(eq(clients.id, clientId), eq(clients.user_id, userId))).limit(1)
    if (!c) throw new Error('Client not found')
    clientId = c.id
    recipientName = c.name
    recipientPhone = recipientPhone ?? c.phone
    recipientEmail = recipientEmail ?? c.email
  }
  if (!recipientName) throw new Error('Who is this proposal for? Add a name')

  const discountValue = num(fd, 'discount_value')
  const gctRate = fd.get('use_gct') === 'true' ? 0.15 : 0
  const additionsAmount = num(fd, 'additions_amount')
  const subtotal = lineSubtotal(items)
  const { gctAmount, total } = computeTotals({ subtotal, discountType, discountValue, gctRate, additionsAmount })

  return {
    fields: {
      client_id: clientId,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_email: recipientEmail,
      title,
      scope: str(fd, 'scope', 5000),
      job_type: str(fd, 'job_type', 100),
      location_address: str(fd, 'location_address', 300),
      currency,
      subtotal,
      discount_type: discountType,
      discount_value: discountValue,
      gct_rate: gctRate,
      gct_amount: gctAmount,
      additions_description: str(fd, 'additions_description', 200),
      additions_amount: additionsAmount,
      total,
      notes: str(fd, 'notes', 2000),
      valid_until: validUntil,
    } as const,
    items,
  }
}

async function insertItems(exec: Exec, proposalId: string, items: ItemInput[]) {
  await exec.insert(proposal_line_items).values(items.map((item, i) => ({
    proposal_id: proposalId,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: round2(item.quantity * item.unit_price),
    sort_order: i,
  })))
}

/** The user's proposal, or throws. */
async function ownedProposal(exec: Exec, id: string, userId: string) {
  const [p] = await exec.select().from(proposals)
    .where(and(eq(proposals.id, id), eq(proposals.user_id, userId))).limit(1)
  if (!p) throw new Error('Not found')
  return p
}

function revalidateProposal(id: string) {
  revalidatePath('/proposals')
  revalidatePath(`/proposals/${id}`)
  revalidatePath('/dashboard')
}

/**
 * Freezes the current proposal into a new version if its content differs from
 * the latest one. Returns the latest version number after the call.
 */
async function snapshotIfChanged(tx: Exec, p: typeof proposals.$inferSelect): Promise<{ version: number; created: boolean }> {
  const items = await tx.select().from(proposal_line_items).where(eq(proposal_line_items.proposal_id, p.id))
  if (items.length === 0) throw new Error('Add at least one line item first')
  const snapshot = buildSnapshot(p, items)
  const [latest] = await tx.select().from(proposal_versions)
    .where(eq(proposal_versions.proposal_id, p.id)).orderBy(desc(proposal_versions.version)).limit(1)
  if (latest && snapshotsEqual(latest.snapshot, snapshot)) return { version: latest.version, created: false }
  const version = (latest?.version ?? 0) + 1
  await tx.insert(proposal_versions).values({ proposal_id: p.id, version, snapshot, total: snapshot.total })
  return { version, created: true }
}

export async function createProposalAction(fd: FormData): Promise<string> {
  const user = await requireUser()
  const { fields, items } = await parseProposalForm(fd, user.id)
  const created = await db.transaction(async (tx) => {
    const row = await insertProposalWithUniqueNumber(tx, user.id, { ...fields, status: 'draft' })
    await insertItems(tx, row.id, items)
    return row
  })
  revalidateProposal(created.id)
  return created.id
}

export async function updateProposalAction(id: string, fd: FormData): Promise<void> {
  const user = await requireUser()
  const current = await ownedProposal(db, id, user.id)
  if (!isEditable(effectiveStatus(current))) throw new Error('This proposal can no longer be edited')
  const { fields, items } = await parseProposalForm(fd, user.id)
  await db.transaction(async (tx) => {
    await tx.delete(proposal_line_items).where(eq(proposal_line_items.proposal_id, id))
    await insertItems(tx, id, items)
    await tx.update(proposals).set({ ...fields, updated_at: new Date().toISOString() })
      .where(and(eq(proposals.id, id), eq(proposals.user_id, user.id)))
  })
  revalidateProposal(id)
}

/**
 * "Send": freezes the content as v1 (sent) or vN+1 (revised) and returns the
 * share token. Re-sending unchanged content just re-shares the latest version.
 */
export async function sendProposalAction(id: string): Promise<{ version: number; shareToken: string }> {
  const user = await requireUser()
  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.user_id, user.id))).for('update').limit(1)
    if (!p) throw new Error('Not found')
    const status = effectiveStatus(p)
    if (status === 'expired') throw new Error('This proposal has expired — renew the date before sending it again')
    if (!isEditable(status)) throw new Error('This proposal can no longer be sent')
    const { version } = await snapshotIfChanged(tx, p)
    await tx.update(proposals).set({
      status: version === 1 ? 'sent' : 'revised',
      changes_requested_at: null,
      updated_at: new Date().toISOString(),
    }).where(eq(proposals.id, id))
    return { version, shareToken: p.share_token }
  })
  revalidateProposal(id)
  return result
}

export async function renewProposalAction(id: string, validUntil: string): Promise<void> {
  const user = await requireUser()
  if (!isDateString(validUntil) || validUntil < todayInBusinessTz()) throw new Error('Pick a date from today onwards')
  const p = await ownedProposal(db, id, user.id)
  if (!isEditable(effectiveStatus(p))) throw new Error('Only open proposals can be renewed')
  await db.update(proposals).set({ valid_until: validUntil, updated_at: new Date().toISOString() })
    .where(and(eq(proposals.id, id), eq(proposals.user_id, user.id)))
  revalidateProposal(id)
}

/** The client agreed outside the app (e.g. on WhatsApp). Freezes the current content as the accepted version. */
export async function markAcceptedAction(id: string): Promise<void> {
  const user = await requireUser()
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.user_id, user.id))).for('update').limit(1)
    if (!p) throw new Error('Not found')
    const status = effectiveStatus(p)
    if (status === 'expired') throw new Error('This proposal has expired — renew it first')
    if (!isEditable(status)) throw new Error('This proposal can’t be accepted')
    const { version } = await snapshotIfChanged(tx, p)
    const now = new Date().toISOString()
    await tx.update(proposals).set({
      status: 'accepted', accepted_at: now, accepted_version: version,
      accepted_by_name: '(marked by you)', changes_requested_at: null, updated_at: now,
    }).where(eq(proposals.id, id))
  })
  revalidateProposal(id)
}

export async function markDeclinedAction(id: string): Promise<void> {
  const user = await requireUser()
  const p = await ownedProposal(db, id, user.id)
  if (p.status === 'converted') throw new Error('A converted proposal can’t be declined')
  await db.update(proposals).set({ status: 'declined', changes_requested_at: null, updated_at: new Date().toISOString() })
    .where(and(eq(proposals.id, id), eq(proposals.user_id, user.id)))
  revalidateProposal(id)
}

export async function deleteProposalAction(id: string): Promise<void> {
  const user = await requireUser()
  const keys = await db.transaction(async (tx) => {
    const p = await ownedProposal(tx, id, user.id)
    if (p.status === 'converted') throw new Error('Converted proposals are kept as the record of the agreement')
    const drawings = await tx.select().from(proposal_drawings).where(eq(proposal_drawings.proposal_id, id))
    await tx.delete(proposals).where(eq(proposals.id, id))
    return drawings.flatMap(d => [d.storage_path, ...(d.preview_paths ?? []), ...(d.zoom_paths ?? [])])
  })
  // Storage deletes can't roll back, so they run only after the commit.
  await removeObjects(keys).catch(() => {})
  revalidatePath('/proposals')
  revalidatePath('/dashboard')
  redirect('/proposals')
}

// ---- Drawings (same on-device watermark pipeline as project deliverables) ----

const drawingPrefix = (userId: string, proposalId: string) => `${userId}/proposals/${proposalId}/`

async function assertEditableOwned(id: string) {
  const user = await requireUser()
  const p = await ownedProposal(db, id, user.id)
  if (!isEditable(effectiveStatus(p))) throw new Error('This proposal can no longer be changed')
  return user
}

export async function createProposalDrawingUploadAction(
  proposalId: string,
  originalSize: number,
  pages: { previewSize: number; zoomSize: number }[],
) {
  const user = await assertEditableOwned(proposalId)
  if (!(originalSize > 0 && originalSize <= MAX_UPLOAD_BYTES)) throw new Error('File exceeds the maximum allowed size')
  if (pages.length === 0 || pages.length > 200) throw new Error('Unexpected page count')
  const JPEG_MAX = 15 * 1024 * 1024
  for (const p of pages) {
    if (!(p.previewSize > 0 && p.previewSize <= JPEG_MAX && p.zoomSize > 0 && p.zoomSize <= JPEG_MAX)) {
      throw new Error('Preview image too large')
    }
  }
  const base = `${drawingPrefix(user.id, proposalId)}drawings/${crypto.randomUUID()}`
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

export async function saveProposalDrawingAction(
  proposalId: string,
  fields: { name: string; storagePath: string; previewPaths: string[]; zoomPaths: string[]; pageCount: number | null; sizeBytes: number | null },
) {
  const user = await assertEditableOwned(proposalId)
  const prefix = drawingPrefix(user.id, proposalId)
  const allPaths = [fields.storagePath, ...fields.previewPaths, ...fields.zoomPaths]
  if (!fields.storagePath.startsWith(prefix) || !/\.pdf$/i.test(fields.storagePath)) throw new Error('Invalid storage path')
  for (const p of [...fields.previewPaths, ...fields.zoomPaths]) {
    if (!p.startsWith(prefix) || !/\.jpg$/i.test(p)) throw new Error('Invalid storage path')
  }
  if (fields.sizeBytes != null && !(fields.sizeBytes > 0 && fields.sizeBytes <= MAX_UPLOAD_BYTES)) {
    throw new Error('File exceeds the maximum allowed size')
  }
  const name = fields.name.trim().slice(0, 200) || 'Drawing'
  try {
    await db.insert(proposal_drawings).values({
      proposal_id: proposalId,
      name,
      storage_path: fields.storagePath,
      preview_paths: fields.previewPaths,
      zoom_paths: fields.zoomPaths,
      page_count: fields.pageCount,
      size_bytes: fields.sizeBytes,
    })
  } catch {
    await removeObjects(allPaths).catch(() => {})
    throw new Error('The drawing uploaded but could not be saved. Please try again.')
  }
  revalidatePath(`/proposals/${proposalId}`)
}

export async function deleteProposalDrawingAction(drawingId: string, proposalId: string) {
  await assertEditableOwned(proposalId)
  const [d] = await db.select().from(proposal_drawings)
    .where(and(eq(proposal_drawings.id, drawingId), eq(proposal_drawings.proposal_id, proposalId))).limit(1)
  if (!d) throw new Error('Not found')
  await db.delete(proposal_drawings).where(eq(proposal_drawings.id, drawingId))
  await removeObjects([d.storage_path, ...(d.preview_paths ?? []), ...(d.zoom_paths ?? [])]).catch(() => {})
  revalidatePath(`/proposals/${proposalId}`)
}

// ---- Convert ---------------------------------------------------------------

/**
 * One tap: client (if a prospect) + in-progress project + draft invoice with the
 * ACCEPTED version's line items, all in one transaction. Drawings move into the
 * project's payment-gated deliverables. The proposal becomes read-only "converted".
 */
export async function convertProposalAction(id: string, workStartedAt: string): Promise<{ invoiceId: string; projectId: string }> {
  const user = await requireUser()
  if (!isDateString(workStartedAt)) throw new Error('Pick the date work started')

  // Geocoding is a network call — do it before the transaction, not inside it.
  const pre = await ownedProposal(db, id, user.id)
  if (pre.status !== 'accepted') throw new Error('Only accepted proposals can be converted')
  const [acceptedVersion] = pre.accepted_version == null ? [] : await db.select({ snapshot: proposal_versions.snapshot })
    .from(proposal_versions)
    .where(and(eq(proposal_versions.proposal_id, id), eq(proposal_versions.version, pre.accepted_version))).limit(1)
  const address = acceptedVersion?.snapshot.location_address
  const coords = address ? await geocodeAddress(address).catch(() => null) : null

  const result = await db.transaction(async (tx) => {
    // Row lock: a double tap waits here, then sees status 'converted' and stops.
    const [p] = await tx.select().from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.user_id, user.id))).for('update').limit(1)
    if (!p) throw new Error('Not found')
    if (p.status !== 'accepted' || p.accepted_version == null) throw new Error('Only accepted proposals can be converted')
    const [v] = await tx.select().from(proposal_versions)
      .where(and(eq(proposal_versions.proposal_id, id), eq(proposal_versions.version, p.accepted_version))).limit(1)
    if (!v) throw new Error('The accepted version is missing')
    const snap = v.snapshot

    let clientId = p.client_id
    if (!clientId) {
      const [c] = await tx.insert(clients).values({
        user_id: user.id, name: p.recipient_name, phone: p.recipient_phone, email: p.recipient_email, currency: snap.currency,
      }).returning({ id: clients.id })
      clientId = c.id
    }

    const now = new Date().toISOString()
    const [proj] = await tx.insert(projects).values({
      user_id: user.id,
      client_id: clientId,
      title: snap.title,
      description: snap.scope,
      status: 'in_progress',
      job_type: snap.job_type,
      location_address: snap.location_address,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    }).returning({ id: projects.id })

    const items = snap.items.map(i => ({ description: invoiceDescription(i), quantity: i.quantity, unit_price: i.unit_price }))
    const subtotal = lineSubtotal(items)
    const { gctAmount, total } = computeTotals({
      subtotal, discountType: snap.discount_type, discountValue: snap.discount_value,
      gctRate: snap.gct_rate, additionsAmount: snap.additions_amount,
    })
    const inv = await insertInvoiceWithUniqueNumber(tx, user.id, {
      project_id: proj.id,
      client_id: clientId,
      currency: snap.currency,
      subtotal,
      discount_type: snap.discount_type,
      discount_value: snap.discount_value,
      gct_rate: snap.gct_rate,
      gct_amount: gctAmount,
      additions_description: snap.additions_description,
      additions_amount: snap.additions_amount,
      total,
      amount_paid: 0,
      due_date: null,
      status: 'draft',
      notes: snap.notes,
      proposal_id: id,
      agreed_amount: snap.total,
      work_started_at: workStartedAt,
    })
    await insertLineItems(tx, inv.id, items)

    // Move drawings (same storage keys) into the project's deliverables, gated on the new invoice.
    const drawings = await tx.select().from(proposal_drawings).where(eq(proposal_drawings.proposal_id, id))
    if (drawings.length > 0) {
      await tx.insert(project_deliverables).values(drawings.map(d => ({
        project_id: proj.id,
        name: d.name,
        storage_path: d.storage_path,
        preview_paths: d.preview_paths,
        zoom_paths: d.zoom_paths,
        page_count: d.page_count,
        size_bytes: d.size_bytes,
        linked_invoice_id: inv.id,
      })))
      await tx.delete(proposal_drawings).where(eq(proposal_drawings.proposal_id, id))
    }

    await tx.update(proposals).set({
      status: 'converted', converted_at: now, client_id: clientId,
      invoice_id: inv.id, project_id: proj.id, updated_at: now,
    }).where(eq(proposals.id, id))

    return { invoiceId: inv.id, projectId: proj.id, clientId }
  })

  revalidateProposal(id)
  revalidatePath('/invoices')
  revalidatePath('/projects')
  revalidatePath('/clients')
  revalidatePath(`/clients/${result.clientId}`)
  return { invoiceId: result.invoiceId, projectId: result.projectId }
}
