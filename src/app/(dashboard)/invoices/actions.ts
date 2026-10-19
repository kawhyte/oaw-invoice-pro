'use server'
import { and, eq, inArray, like } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db, invoices, invoice_line_items, invoice_payments, projects, clients, project_files } from '@/db'
import { requireUser } from '@/lib/session'
import { putObject, removeObjects } from '@/lib/storage'
import type { Currency, DiscountType } from '@/types'
import { lineSubtotal, computeTotals, computeStatus, round2 } from '@/lib/invoiceCalc'
import { todayInBusinessTz } from '@/lib/dates'
import { renderInvoicePdf } from '@/lib/invoicePdf'

// Multi-step writes run in a transaction so a failure leaves nothing half-saved.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Exec = typeof db | Tx

type NewInvoice = Omit<typeof invoices.$inferInsert, 'user_id' | 'invoice_number'>
type LineItemInput = { description: string; quantity: number; unit_price: number }

/**
 * Deletes the saved-invoice-PDF rows for these invoices and returns their storage
 * keys. Call inside the transaction; remove the returned keys from storage only
 * AFTER the transaction commits (storage deletes can't be rolled back).
 */
async function deleteSavedInvoicePdfRows(exec: Exec, invoiceIds: string[]): Promise<string[]> {
  if (invoiceIds.length === 0) return []
  const files = await exec.select({ id: project_files.id, storage_path: project_files.storage_path })
    .from(project_files).where(inArray(project_files.invoice_id, invoiceIds))
  if (files.length === 0) return []
  await exec.delete(project_files).where(inArray(project_files.id, files.map(f => f.id)))
  return files.map(f => f.storage_path)
}

/**
 * Next invoice number for a user, based on the MAX existing INV-#### (not a count),
 * so deletions/combine never cause a new invoice to reuse a freed number.
 * If `preferred` is given and still free, it's used (lets "Separate" restore originals).
 */
async function nextInvoiceNumber(exec: Exec, userId: string, preferred?: string | null): Promise<string> {
  if (preferred) {
    const taken = await exec.select({ id: invoices.id }).from(invoices)
      .where(and(eq(invoices.user_id, userId), eq(invoices.invoice_number, preferred))).limit(1)
    if (taken.length === 0) return preferred
  }
  const rows = await exec.select({ invoice_number: invoices.invoice_number }).from(invoices)
    .where(and(eq(invoices.user_id, userId), like(invoices.invoice_number, 'INV-%')))
  let max = 0
  for (const row of rows) {
    const m = /^INV-0*(\d+)$/.exec(row.invoice_number)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `INV-${String(max + 1).padStart(3, '0')}`
}

function pgErrorCode(err: unknown): string | undefined {
  // Drizzle wraps driver errors; the Postgres code lives on the cause.
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.cause?.code ?? e?.code
}

/**
 * Inserts an invoice, allocating a unique invoice_number and retrying if a
 * concurrent insert grabbed the same number (Postgres unique violation 23505).
 * Each attempt runs in a savepoint so a collision doesn't abort the caller's transaction.
 */
async function insertInvoiceWithUniqueNumber(
  exec: Exec,
  userId: string,
  payload: NewInvoice,
  preferred?: string | null
): Promise<{ id: string; invoice_number: string }> {
  let prefer = preferred ?? null
  for (let attempt = 0; attempt < 4; attempt++) {
    const invoice_number = await nextInvoiceNumber(exec, userId, prefer)
    try {
      return await exec.transaction(async (sp) => {
        const [row] = await sp.insert(invoices)
          .values({ ...payload, user_id: userId, invoice_number })
          .returning({ id: invoices.id, invoice_number: invoices.invoice_number })
        return row
      })
    } catch (err) {
      if (pgErrorCode(err) === '23505') { prefer = null; continue }
      throw new Error('Failed to create invoice')
    }
  }
  throw new Error('Could not allocate a unique invoice number')
}

async function insertLineItems(exec: Exec, invoiceId: string, items: LineItemInput[]) {
  if (items.length === 0) return
  await exec.insert(invoice_line_items).values(items.map((item, i) => ({
    invoice_id: invoiceId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: round2(item.quantity * item.unit_price),
    sort_order: i,
  })))
}

export async function createInvoiceAction(formData: FormData): Promise<string> {
  const user = await requireUser()

  const lineItems = JSON.parse(formData.get('line_items') as string) as LineItemInput[]
  const currency = formData.get('currency') as Currency
  const discountType = (formData.get('discount_type') as DiscountType) || 'none'
  const discountValue = parseFloat(formData.get('discount_value') as string) || 0
  const gctRate = formData.get('use_gct') === 'true' ? 0.15 : 0
  const additionsAmount = parseFloat(formData.get('additions_amount') as string) || 0
  const amountPaid = parseFloat(formData.get('amount_paid') as string) || 0
  const dueDate = (formData.get('due_date') as string) || null

  const subtotal = lineSubtotal(lineItems)
  const { gctAmount, total } = computeTotals({ subtotal, discountType, discountValue, gctRate, additionsAmount })
  const status = computeStatus({ amountPaid, total, dueDate, wasSent: false })

  const projectId = formData.get('project_id') as string
  // Verify the project belongs to the user and capture its client for the direct link.
  const [project] = await db.select({ client_id: projects.client_id }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.user_id, user.id))).limit(1)
  if (!project) throw new Error('Not found')

  const invoice = await db.transaction(async (tx) => {
    const created = await insertInvoiceWithUniqueNumber(tx, user.id, {
      project_id: projectId,
      client_id: project.client_id,
      currency,
      subtotal,
      discount_type: discountType,
      discount_value: discountValue,
      gct_rate: gctRate,
      gct_amount: gctAmount,
      additions_description: (formData.get('additions_description') as string) || null,
      additions_amount: additionsAmount,
      total,
      amount_paid: amountPaid,
      due_date: dueDate,
      status,
      notes: (formData.get('notes') as string) || null,
    })
    await insertLineItems(tx, created.id, lineItems)
    return created
  })

  revalidatePath('/invoices')
  return invoice.id
}

export async function updateAmountPaidAction(invoiceId: string, amountPaid: number) {
  const user = await requireUser()
  const [invoice] = await db.select({ total: invoices.total, due_date: invoices.due_date, status: invoices.status })
    .from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.user_id, user.id))).limit(1)
  if (!invoice) throw new Error('Not found')

  const wasSent = invoice.status === 'sent'
  const status = computeStatus({ amountPaid, total: invoice.total, dueDate: invoice.due_date, wasSent })

  await db.update(invoices).set({ amount_paid: amountPaid, status })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.user_id, user.id)))
  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
}

export async function markSentAction(invoiceId: string) {
  const user = await requireUser()
  await db.update(invoices).set({ status: 'sent' })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.user_id, user.id), eq(invoices.status, 'draft')))
  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
}

export async function updateInvoiceAction(invoiceId: string, formData: FormData): Promise<void> {
  const user = await requireUser()

  const [current] = await db.select({ status: invoices.status }).from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.user_id, user.id))).limit(1)
  if (!current) throw new Error('Not found')
  const wasSent = current.status !== 'draft'

  const lineItems = JSON.parse(formData.get('line_items') as string) as LineItemInput[]
  const currency = formData.get('currency') as Currency
  const discountType = (formData.get('discount_type') as DiscountType) || 'none'
  const discountValue = parseFloat(formData.get('discount_value') as string) || 0
  const gctRate = formData.get('use_gct') === 'true' ? 0.15 : 0
  const additionsAmount = parseFloat(formData.get('additions_amount') as string) || 0
  const amountPaid = parseFloat(formData.get('amount_paid') as string) || 0
  const dueDate = (formData.get('due_date') as string) || null

  const subtotal = lineSubtotal(lineItems)
  const { gctAmount, total } = computeTotals({ subtotal, discountType, discountValue, gctRate, additionsAmount })
  const status = computeStatus({ amountPaid, total, dueDate, wasSent })

  // Replace items + update totals atomically: a failure keeps the old version intact.
  await db.transaction(async (tx) => {
    await tx.delete(invoice_line_items).where(eq(invoice_line_items.invoice_id, invoiceId))
    await insertLineItems(tx, invoiceId, lineItems)
    await tx.update(invoices).set({
      currency,
      discount_type: discountType,
      discount_value: discountValue,
      gct_rate: gctRate,
      gct_amount: gctAmount,
      additions_description: (formData.get('additions_description') as string) || null,
      additions_amount: additionsAmount,
      subtotal,
      total,
      amount_paid: amountPaid,
      due_date: dueDate || null,
      status,
      notes: (formData.get('notes') as string) || null,
    }).where(and(eq(invoices.id, invoiceId), eq(invoices.user_id, user.id)))
  })

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  redirect(`/invoices/${invoiceId}`)
}

export async function deleteInvoiceAction(id: string) {
  const user = await requireUser()
  const keys = await db.transaction(async (tx) => {
    const [owned] = await tx.select({ id: invoices.id }).from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.user_id, user.id))).limit(1)
    if (!owned) return []
    const k = await deleteSavedInvoicePdfRows(tx, [id])
    await tx.delete(invoices).where(eq(invoices.id, id))
    return k
  })
  await removeObjects(keys).catch(() => {})
  revalidatePath('/invoices')
}

/**
 * Generates the invoice PDF server-side and saves it straight into a project's
 * Files (object storage + `project_files` table) — the same place a manual
 * upload lands, so it's immediately visible to the client on the share page.
 * Replaces any previously saved copy of this invoice (one PDF per invoice).
 *
 * `projectId` is the target project: for single-project invoices it must equal
 * the invoice's project; for combined invoices it must be one of the projects
 * the invoice bills (the user picks in the UI).
 */
export async function uploadInvoicePdfAction(invoiceId: string, projectId: string): Promise<void> {
  const user = await requireUser()

  // Invoice must belong to the user.
  const invoice = await db.query.invoices.findFirst({
    columns: { id: true, invoice_number: true, project_id: true },
    with: { invoice_line_items: { columns: { project_id: true } } },
    where: and(eq(invoices.id, invoiceId), eq(invoices.user_id, user.id)),
  })
  if (!invoice) throw new Error('Not found')

  // Target project must belong to the user...
  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.user_id, user.id))).limit(1)
  if (!project) throw new Error('Not found')

  // ...and be a valid target for this invoice.
  if (invoice.project_id !== null) {
    if (invoice.project_id !== projectId) throw new Error('Invalid project for this invoice')
  } else {
    const lineProjectIds = new Set(invoice.invoice_line_items.map(li => li.project_id).filter((id): id is string => !!id))
    if (!lineProjectIds.has(projectId)) throw new Error('Invalid project for this invoice')
  }

  const result = await renderInvoicePdf(invoiceId, user.id)
  if (!result) throw new Error('Not found')

  const storagePath = `${user.id}/${projectId}/${Date.now()}-${invoice.invoice_number}.pdf`
  await putObject(storagePath, result.buffer, 'application/pdf')

  // Swap the saved copy atomically; delete the old object only once that's committed.
  let oldKeys: string[] = []
  try {
    oldKeys = await db.transaction(async (tx) => {
      const k = await deleteSavedInvoicePdfRows(tx, [invoiceId])
      await tx.insert(project_files).values({
        project_id: projectId,
        invoice_id: invoiceId,
        name: `${invoice.invoice_number}.pdf`,
        storage_path: storagePath,
        size_bytes: result.buffer.length,
      })
      return k
    })
  } catch (err) {
    await removeObjects([storagePath]).catch(() => {})
    throw err
  }
  await removeObjects(oldKeys).catch(() => {})

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/invoices/${invoiceId}`)
}

/**
 * Separates a DRAFT combined invoice back into individual per-project draft
 * invoices (undo a mistaken combine). Only allowed while the invoice is a draft:
 * once it has been sent or has any payment, separating would corrupt the billing
 * record and the client has already received the combined document — so it's
 * locked (mirrors the "can't edit a paid invoice" rule).
 *
 * Combined-level discount/additions are NOT carried over (they applied to the
 * whole); GCT is re-applied per new invoice at the same rate.
 */
export async function separateInvoiceAction(invoiceId: string): Promise<void> {
  const user = await requireUser()

  const invoice = await db.query.invoices.findFirst({
    columns: { id: true, status: true, project_id: true, client_id: true, currency: true, gct_rate: true, source_meta: true },
    with: { invoice_line_items: { orderBy: invoice_line_items.sort_order } },
    where: and(eq(invoices.id, invoiceId), eq(invoices.user_id, user.id)),
  })
  if (!invoice) throw new Error('Not found')
  if (invoice.project_id !== null) throw new Error('Only combined invoices can be separated')
  if (invoice.status !== 'draft') throw new Error('Only draft invoices can be separated — this one has been sent or paid')

  const sourceMeta = (invoice.source_meta as Record<string, string> | null) ?? {}

  // Group line items by their project.
  const groups = new Map<string, { section_title: string | null; items: LineItemInput[] }>()
  for (const li of invoice.invoice_line_items) {
    if (!li.project_id) continue
    const g = groups.get(li.project_id) ?? { section_title: li.section_title, items: [] }
    g.items.push({ description: li.description, quantity: Number(li.quantity), unit_price: Number(li.unit_price) })
    groups.set(li.project_id, g)
  }
  if (groups.size < 2) throw new Error('Nothing to separate')

  const gctRate = Number(invoice.gct_rate) || 0

  const keys = await db.transaction(async (tx) => {
    for (const [projectId, g] of groups) {
      const subtotal = lineSubtotal(g.items)
      const { gctAmount, total } = computeTotals({ subtotal, discountType: 'none', discountValue: 0, gctRate, additionsAmount: 0 })
      // Restore the project's original draft number if it's still free, else next free.
      const created = await insertInvoiceWithUniqueNumber(tx, user.id, {
        project_id: projectId,
        client_id: invoice.client_id,
        currency: invoice.currency,
        subtotal,
        discount_type: 'none',
        discount_value: 0,
        gct_rate: gctRate,
        gct_amount: gctAmount,
        additions_description: null,
        additions_amount: 0,
        total,
        amount_paid: 0,
        due_date: null,
        status: 'draft',
        notes: null,
        source_meta: null,
      }, sourceMeta[projectId])
      await insertLineItems(tx, created.id, g.items)
    }
    // The combined invoice is going away; drop its saved PDF row too.
    const k = await deleteSavedInvoicePdfRows(tx, [invoiceId])
    await tx.delete(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.user_id, user.id)))
    return k
  })
  await removeObjects(keys).catch(() => {})

  revalidatePath('/invoices')
  if (invoice.client_id) revalidatePath(`/clients/${invoice.client_id}`)
  for (const projectId of groups.keys()) revalidatePath(`/projects/${projectId}`)
  redirect('/invoices')
}

interface CombinedSection {
  project_id: string
  section_title: string
  line_items: LineItemInput[]
}

/**
 * Creates a combined invoice spanning multiple projects of a single client.
 * Line items are grouped by project; discount/GCT/additions apply once to the
 * combined total. Any DRAFT invoices passed in `absorb_invoice_ids` are deleted
 * so their work is not double-billed.
 */
export async function createCombinedInvoiceAction(formData: FormData): Promise<string> {
  const user = await requireUser()

  const clientId = formData.get('client_id') as string
  const [client] = await db.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.user_id, user.id))).limit(1)
  if (!client) throw new Error('Not found')

  const sections = (JSON.parse(formData.get('sections') as string) as CombinedSection[])
    .map(s => ({
      ...s,
      line_items: s.line_items.filter(i => i.description?.trim() && (i.unit_price || 0) > 0),
    }))
    .filter(s => s.line_items.length > 0)

  if (sections.length < 2) throw new Error('A combined invoice needs at least two projects with line items')

  // Every project must belong to this user AND this client.
  const projectIds = sections.map(s => s.project_id)
  const validProjects = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.user_id, user.id), eq(projects.client_id, clientId), inArray(projects.id, projectIds)))
  const validProjectIds = new Set(validProjects.map(p => p.id))
  if (projectIds.some(id => !validProjectIds.has(id))) throw new Error('Invalid project selection')

  const currency = (formData.get('currency') as string) === 'USD' ? 'USD' : 'JMD'
  const discountType = (formData.get('discount_type') as DiscountType) || 'none'
  const discountValue = parseFloat(formData.get('discount_value') as string) || 0
  const gctRate = formData.get('use_gct') === 'true' ? 0.15 : 0
  const additionsAmount = parseFloat(formData.get('additions_amount') as string) || 0
  const amountPaid = parseFloat(formData.get('amount_paid') as string) || 0
  const dueDate = (formData.get('due_date') as string) || null

  const allItems = sections.flatMap(s => s.line_items)
  const subtotal = lineSubtotal(allItems)
  const { gctAmount, total } = computeTotals({ subtotal, discountType, discountValue, gctRate, additionsAmount })
  const status = computeStatus({ amountPaid, total, dueDate, wasSent: false })

  const absorbIds = (JSON.parse((formData.get('absorb_invoice_ids') as string) || '[]') as string[])

  // Create the combined invoice + items and absorb the source drafts atomically:
  // either everything happens, or nothing changes.
  const { invoice, keys } = await db.transaction(async (tx) => {
    // Record each absorbed draft's number so "Separate" can restore the originals.
    let sourceMeta: Record<string, string> | null = null
    if (absorbIds.length > 0) {
      const absorbed = await tx.select({ project_id: invoices.project_id, invoice_number: invoices.invoice_number })
        .from(invoices)
        .where(and(inArray(invoices.id, absorbIds), eq(invoices.user_id, user.id), eq(invoices.status, 'draft')))
      sourceMeta = {}
      for (const a of absorbed) if (a.project_id) sourceMeta[a.project_id] = a.invoice_number
      if (Object.keys(sourceMeta).length === 0) sourceMeta = null
    }

    const created = await insertInvoiceWithUniqueNumber(tx, user.id, {
      project_id: null,
      client_id: clientId,
      currency,
      subtotal,
      discount_type: discountType,
      discount_value: discountValue,
      gct_rate: gctRate,
      gct_amount: gctAmount,
      additions_description: (formData.get('additions_description') as string) || null,
      additions_amount: additionsAmount,
      total,
      amount_paid: amountPaid,
      due_date: dueDate,
      status,
      notes: (formData.get('notes') as string) || null,
      source_meta: sourceMeta,
    })

    let sortOrder = 0
    const rows = sections.flatMap(s =>
      s.line_items.map(item => ({
        invoice_id: created.id,
        project_id: s.project_id,
        section_title: s.section_title,
        description: item.description.trim(),
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        amount: round2((item.quantity || 1) * (item.unit_price || 0)),
        sort_order: sortOrder++,
      }))
    )
    if (rows.length > 0) await tx.insert(invoice_line_items).values(rows)

    // Absorb (delete) the source DRAFT invoices so their work isn't double-billed.
    let k: string[] = []
    if (absorbIds.length > 0) {
      const draftIds = (await tx.select({ id: invoices.id }).from(invoices)
        .where(and(inArray(invoices.id, absorbIds), eq(invoices.user_id, user.id), eq(invoices.status, 'draft'))))
        .map(r => r.id)
      k = await deleteSavedInvoicePdfRows(tx, draftIds)
      if (draftIds.length > 0) await tx.delete(invoices).where(inArray(invoices.id, draftIds))
    }
    return { invoice: created, keys: k }
  })
  await removeObjects(keys).catch(() => {})

  revalidatePath('/invoices')
  revalidatePath(`/clients/${clientId}`)
  projectIds.forEach(pid => revalidatePath(`/projects/${pid}`))
  return invoice.id
}

// Verify a payment belongs to an invoice owned by the current user.
async function assertPaymentOwned(paymentId: string, invoiceId: string, userId: string) {
  const [row] = await db.select({ id: invoice_payments.id }).from(invoice_payments)
    .innerJoin(invoices, eq(invoices.id, invoice_payments.invoice_id))
    .where(and(eq(invoice_payments.id, paymentId), eq(invoice_payments.invoice_id, invoiceId), eq(invoices.user_id, userId)))
    .limit(1)
  if (!row) throw new Error('Not found')
}

export async function markPaymentPaidAction(paymentId: string, invoiceId: string) {
  const user = await requireUser()
  await assertPaymentOwned(paymentId, invoiceId, user.id)
  await db.update(invoice_payments).set({ status: 'paid', paid_date: todayInBusinessTz() })
    .where(eq(invoice_payments.id, paymentId))
  revalidatePath(`/invoices/${invoiceId}`)
}

export async function markPaymentUnpaidAction(paymentId: string, invoiceId: string) {
  const user = await requireUser()
  await assertPaymentOwned(paymentId, invoiceId, user.id)
  await db.update(invoice_payments).set({ status: 'pending', paid_date: null })
    .where(eq(invoice_payments.id, paymentId))
  revalidatePath(`/invoices/${invoiceId}`)
}
