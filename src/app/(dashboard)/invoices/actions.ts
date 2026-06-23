'use server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { DiscountType } from '@/types'
import { lineSubtotal, computeTotals, computeStatus, round2 } from '@/lib/invoiceCalc'
import { renderInvoicePdf } from '@/lib/invoicePdf'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/**
 * Removes any saved invoice PDFs (project_files rows + their storage objects)
 * for the given invoices. Call BEFORE deleting an invoice so its saved copy
 * never lingers as an orphan in the bucket. The DB rows are also cleared by the
 * invoice_id FK cascade, but storage objects must be removed explicitly.
 */
async function cleanupSavedInvoicePdfs(supabase: SupabaseServer, invoiceIds: string[]) {
  if (invoiceIds.length === 0) return
  const { data: files } = await supabase
    .from('project_files')
    .select('id, storage_path')
    .in('invoice_id', invoiceIds)
  if (!files || files.length === 0) return
  const service = createServiceClient()
  await service.storage.from('project-files').remove(files.map(f => f.storage_path))
  await supabase.from('project_files').delete().in('id', files.map(f => f.id))
}

/**
 * Next invoice number for a user, based on the MAX existing INV-#### (not a count),
 * so deletions/combine never cause a new invoice to reuse a freed number.
 * If `preferred` is given and still free, it's used (lets "Separate" restore originals).
 */
async function nextInvoiceNumber(supabase: SupabaseServer, userId: string, preferred?: string | null): Promise<string> {
  if (preferred) {
    const { data: taken } = await supabase
      .from('invoices').select('id').eq('user_id', userId).eq('invoice_number', preferred).limit(1)
    if (!taken || taken.length === 0) return preferred
  }
  const { data } = await supabase
    .from('invoices').select('invoice_number').eq('user_id', userId).like('invoice_number', 'INV-%')
  let max = 0
  for (const row of (data ?? []) as { invoice_number: string }[]) {
    const m = /^INV-0*(\d+)$/.exec(row.invoice_number)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `INV-${String(max + 1).padStart(3, '0')}`
}

/**
 * Inserts an invoice, allocating a unique invoice_number and retrying if a
 * concurrent insert grabbed the same number (Postgres unique violation 23505).
 */
async function insertInvoiceWithUniqueNumber(
  supabase: SupabaseServer,
  userId: string,
  payload: Record<string, unknown>,
  preferred?: string | null
): Promise<{ id: string; invoice_number: string }> {
  let prefer = preferred ?? null
  for (let attempt = 0; attempt < 4; attempt++) {
    const invoice_number = await nextInvoiceNumber(supabase, userId, prefer)
    const { data, error } = await supabase
      .from('invoices')
      .insert({ ...payload, user_id: userId, invoice_number })
      .select('id, invoice_number')
      .single()
    if (!error && data) return data
    if ((error as { code?: string } | null)?.code === '23505') { prefer = null; continue }
    throw new Error('Failed to create invoice')
  }
  throw new Error('Could not allocate a unique invoice number')
}

export async function createInvoiceAction(formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const lineItems = JSON.parse(formData.get('line_items') as string) as { description: string; quantity: number; unit_price: number }[]
  const currency = formData.get('currency') as string
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
  const { data: project } = await supabase
    .from('projects')
    .select('client_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) throw new Error('Not found')

  const invoice = await insertInvoiceWithUniqueNumber(supabase, user.id, {
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

  if (lineItems.length > 0) {
    await supabase.from('invoice_line_items').insert(
      lineItems.map((item, i) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: round2(item.quantity * item.unit_price),
        sort_order: i,
      }))
    )
  }

  revalidatePath('/invoices')
  return invoice.id
}

export async function updateAmountPaidAction(invoiceId: string, amountPaid: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: invoice } = await supabase.from('invoices').select('total, due_date, status').eq('id', invoiceId).eq('user_id', user.id).single()
  if (!invoice) throw new Error('Not found')

  const wasSent = invoice.status === 'sent'
  const status = computeStatus({ amountPaid, total: invoice.total, dueDate: invoice.due_date, wasSent })

  await supabase.from('invoices').update({ amount_paid: amountPaid, status }).eq('id', invoiceId).eq('user_id', user.id)
  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
}

export async function markSentAction(invoiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoiceId).eq('user_id', user.id).eq('status', 'draft')
  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
}

export async function updateInvoiceAction(invoiceId: string, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: current } = await supabase.from('invoices').select('status').eq('id', invoiceId).eq('user_id', user.id).single()
  if (!current) throw new Error('Not found')
  const wasSent = current.status !== 'draft'

  const lineItems = JSON.parse(formData.get('line_items') as string) as { description: string; quantity: number; unit_price: number }[]
  const currency = formData.get('currency') as string
  const discountType = (formData.get('discount_type') as DiscountType) || 'none'
  const discountValue = parseFloat(formData.get('discount_value') as string) || 0
  const gctRate = formData.get('use_gct') === 'true' ? 0.15 : 0
  const additionsAmount = parseFloat(formData.get('additions_amount') as string) || 0
  const amountPaid = parseFloat(formData.get('amount_paid') as string) || 0
  const dueDate = (formData.get('due_date') as string) || null

  const subtotal = lineSubtotal(lineItems)
  const { gctAmount, total } = computeTotals({ subtotal, discountType, discountValue, gctRate, additionsAmount })
  const status = computeStatus({ amountPaid, total, dueDate, wasSent })

  await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId)
  if (lineItems.length > 0) {
    await supabase.from('invoice_line_items').insert(
      lineItems.map((item, i) => ({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: round2(item.quantity * item.unit_price),
        sort_order: i,
      }))
    )
  }

  await supabase.from('invoices').update({
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
  }).eq('id', invoiceId).eq('user_id', user.id)

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
  redirect(`/invoices/${invoiceId}`)
}

export async function deleteInvoiceAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await cleanupSavedInvoicePdfs(supabase, [id])
  await supabase.from('invoices').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/invoices')
}

/**
 * Generates the invoice PDF server-side and saves it straight into a project's
 * Files (the `project-files` bucket + `project_files` table) — the same place a
 * manual upload lands, so it's immediately visible to the client on the share
 * page. Replaces any previously saved copy of this invoice (one PDF per
 * invoice, no stale duplicates).
 *
 * `projectId` is the target project: for single-project invoices it must equal
 * the invoice's project; for combined invoices it must be one of the projects
 * the invoice bills (the user picks in the UI).
 */
export async function uploadInvoicePdfAction(invoiceId: string, projectId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Invoice must belong to the user.
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, project_id, invoice_line_items(project_id)')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()
  if (!invoice) throw new Error('Not found')

  // Target project must belong to the user...
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()
  if (!project) throw new Error('Not found')

  // ...and be a valid target for this invoice.
  if (invoice.project_id !== null) {
    if (invoice.project_id !== projectId) throw new Error('Invalid project for this invoice')
  } else {
    const lineProjectIds = new Set(
      ((invoice.invoice_line_items ?? []) as { project_id: string | null }[])
        .map(li => li.project_id)
        .filter((id): id is string => !!id)
    )
    if (!lineProjectIds.has(projectId)) throw new Error('Invalid project for this invoice')
  }

  const result = await renderInvoicePdf(supabase, invoiceId, user.id)
  if (!result) throw new Error('Not found')

  // Replace any previously saved copy (storage object + row) for this invoice.
  await cleanupSavedInvoicePdfs(supabase, [invoiceId])

  const service = createServiceClient()
  const storagePath = `${user.id}/${projectId}/${Date.now()}-${invoice.invoice_number}.pdf`
  const { error: uploadError } = await service.storage
    .from('project-files')
    .upload(storagePath, result.buffer, { contentType: 'application/pdf', upsert: false })
  if (uploadError) throw new Error('Upload failed')

  await supabase.from('project_files').insert({
    project_id: projectId,
    invoice_id: invoiceId,
    name: `${invoice.invoice_number}.pdf`,
    storage_path: storagePath,
    size_bytes: result.buffer.length,
  })

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status, project_id, client_id, currency, gct_rate, source_meta, invoice_line_items(*)')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()
  if (!invoice) throw new Error('Not found')
  if (invoice.project_id !== null) throw new Error('Only combined invoices can be separated')
  if (invoice.status !== 'draft') throw new Error('Only draft invoices can be separated — this one has been sent or paid')

  const sourceMeta = (invoice.source_meta as Record<string, string> | null) ?? {}

  // Group line items by their project.
  const groups = new Map<string, { section_title: string | null; items: { description: string; quantity: number; unit_price: number }[] }>()
  for (const li of (invoice.invoice_line_items ?? []) as InvoiceLineItemRow[]) {
    if (!li.project_id) continue
    const g = groups.get(li.project_id) ?? { section_title: li.section_title, items: [] }
    g.items.push({ description: li.description, quantity: Number(li.quantity), unit_price: Number(li.unit_price) })
    groups.set(li.project_id, g)
  }
  if (groups.size < 2) throw new Error('Nothing to separate')

  const gctRate = Number(invoice.gct_rate) || 0

  for (const [projectId, g] of groups) {
    const subtotal = lineSubtotal(g.items)
    const { gctAmount, total } = computeTotals({ subtotal, discountType: 'none', discountValue: 0, gctRate, additionsAmount: 0 })
    // Restore the project's original draft number if it's still free, else next free.
    const created = await insertInvoiceWithUniqueNumber(supabase, user.id, {
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

    if (g.items.length > 0) {
      await supabase.from('invoice_line_items').insert(
        g.items.map((item, i) => ({
          invoice_id: created.id,
          project_id: null,
          section_title: null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: round2(item.quantity * item.unit_price),
          sort_order: i,
        }))
      )
    }
  }

  // The combined invoice is going away; drop its saved PDF so it isn't orphaned.
  await cleanupSavedInvoicePdfs(supabase, [invoiceId])
  await supabase.from('invoices').delete().eq('id', invoiceId).eq('user_id', user.id)

  revalidatePath('/invoices')
  if (invoice.client_id) revalidatePath(`/clients/${invoice.client_id}`)
  for (const projectId of groups.keys()) revalidatePath(`/projects/${projectId}`)
  redirect('/invoices')
}

interface InvoiceLineItemRow {
  project_id: string | null
  section_title: string | null
  description: string
  quantity: number
  unit_price: number
}

interface CombinedSection {
  project_id: string
  section_title: string
  line_items: { description: string; quantity: number; unit_price: number }[]
}

/**
 * Creates a combined invoice spanning multiple projects of a single client.
 * Line items are grouped by project; discount/GCT/additions apply once to the
 * combined total. Any DRAFT invoices passed in `absorb_invoice_ids` are deleted
 * so their work is not double-billed.
 */
export async function createCombinedInvoiceAction(formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const clientId = formData.get('client_id') as string
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('user_id', user.id)
    .single()
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
  const { data: validProjects } = await supabase
    .from('projects')
    .select('id, title')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .in('id', projectIds)
  const validProjectIds = new Set((validProjects ?? []).map(p => p.id))
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

  // Record each absorbed draft's number so "Separate" can restore the originals.
  const absorbIds = (JSON.parse((formData.get('absorb_invoice_ids') as string) || '[]') as string[])
  let sourceMeta: Record<string, string> | null = null
  if (absorbIds.length > 0) {
    const { data: absorbed } = await supabase
      .from('invoices')
      .select('project_id, invoice_number')
      .in('id', absorbIds)
      .eq('user_id', user.id)
      .eq('status', 'draft')
    sourceMeta = {}
    for (const a of (absorbed ?? []) as { project_id: string | null; invoice_number: string }[]) {
      if (a.project_id) sourceMeta[a.project_id] = a.invoice_number
    }
    if (Object.keys(sourceMeta).length === 0) sourceMeta = null
  }

  const invoice = await insertInvoiceWithUniqueNumber(supabase, user.id, {
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
      invoice_id: invoice.id,
      project_id: s.project_id,
      section_title: s.section_title,
      description: item.description.trim(),
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      amount: round2((item.quantity || 1) * (item.unit_price || 0)),
      sort_order: sortOrder++,
    }))
  )
  if (rows.length > 0) await supabase.from('invoice_line_items').insert(rows)

  // Absorb (delete) the source DRAFT invoices so their work isn't double-billed.
  if (absorbIds.length > 0) {
    await cleanupSavedInvoicePdfs(supabase, absorbIds)
    await supabase
      .from('invoices')
      .delete()
      .in('id', absorbIds)
      .eq('user_id', user.id)
      .eq('status', 'draft')
  }

  revalidatePath('/invoices')
  revalidatePath(`/clients/${clientId}`)
  projectIds.forEach(pid => revalidatePath(`/projects/${pid}`))
  return invoice.id
}

// Verify a payment belongs to an invoice owned by the current user.
async function assertPaymentOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paymentId: string,
  invoiceId: string,
  userId: string
) {
  const { data: payment } = await supabase
    .from('invoice_payments')
    .select('id, invoices!inner(user_id)')
    .eq('id', paymentId)
    .eq('invoice_id', invoiceId)
    .single()
  if (!payment || (payment.invoices as unknown as { user_id: string })?.user_id !== userId) {
    throw new Error('Not found')
  }
}

export async function markPaymentPaidAction(paymentId: string, invoiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await assertPaymentOwned(supabase, paymentId, invoiceId, user.id)
  await supabase
    .from('invoice_payments')
    .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
    .eq('id', paymentId)
  revalidatePath(`/invoices/${invoiceId}`)
}

export async function markPaymentUnpaidAction(paymentId: string, invoiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await assertPaymentOwned(supabase, paymentId, invoiceId, user.id)
  await supabase
    .from('invoice_payments')
    .update({ status: 'pending', paid_date: null })
    .eq('id', paymentId)
  revalidatePath(`/invoices/${invoiceId}`)
}
