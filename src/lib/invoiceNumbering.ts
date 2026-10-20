import 'server-only'
import { and, eq, like } from 'drizzle-orm'
import { db, invoices, invoice_line_items, proposals } from '@/db'
import { round2 } from '@/lib/invoiceCalc'

// Numbering + insert helpers shared by invoice and proposal server actions.
// They live here, NOT in a 'use server' file: every export of a 'use server'
// module becomes a publicly callable action endpoint.

// Multi-step writes run in a transaction so a failure leaves nothing half-saved.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export type Exec = typeof db | Tx

export type NewInvoice = Omit<typeof invoices.$inferInsert, 'user_id' | 'invoice_number'>
export type LineItemInput = { description: string; quantity: number; unit_price: number }

/**
 * Next invoice number for a user, based on the MAX existing INV-#### (not a count),
 * so deletions/combine never cause a new invoice to reuse a freed number.
 * If `preferred` is given and still free, it's used (lets "Separate" restore originals).
 */
export async function nextInvoiceNumber(exec: Exec, userId: string, preferred?: string | null): Promise<string> {
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

export function pgErrorCode(err: unknown): string | undefined {
  // Drizzle wraps driver errors; the Postgres code lives on the cause.
  const e = err as { code?: string; cause?: { code?: string } }
  return e?.cause?.code ?? e?.code
}

/**
 * Inserts an invoice, allocating a unique invoice_number and retrying if a
 * concurrent insert grabbed the same number (Postgres unique violation 23505).
 * Each attempt runs in a savepoint so a collision doesn't abort the caller's transaction.
 */
export async function insertInvoiceWithUniqueNumber(
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

export async function insertLineItems(exec: Exec, invoiceId: string, items: LineItemInput[]) {
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


/** Next PRO-### for a user: MAX of existing numbers (never a count), like invoices. */
export async function nextProposalNumber(exec: Exec, userId: string): Promise<string> {
  const rows = await exec.select({ proposal_number: proposals.proposal_number }).from(proposals)
    .where(and(eq(proposals.user_id, userId), like(proposals.proposal_number, 'PRO-%')))
  let max = 0
  for (const row of rows) {
    const m = /^PRO-0*(\d+)$/.exec(row.proposal_number)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `PRO-${String(max + 1).padStart(3, '0')}`
}

type NewProposal = Omit<typeof proposals.$inferInsert, 'user_id' | 'proposal_number'>

/** Inserts a proposal with a unique PRO-### (savepoint + retry on 23505, like invoices). */
export async function insertProposalWithUniqueNumber(
  exec: Exec,
  userId: string,
  payload: NewProposal,
): Promise<{ id: string; proposal_number: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const proposal_number = await nextProposalNumber(exec, userId)
    try {
      return await exec.transaction(async (sp) => {
        const [row] = await sp.insert(proposals)
          .values({ ...payload, user_id: userId, proposal_number })
          .returning({ id: proposals.id, proposal_number: proposals.proposal_number })
        return row
      })
    } catch (err) {
      if (pgErrorCode(err) === '23505') continue
      throw new Error('Failed to create proposal')
    }
  }
  throw new Error('Could not allocate a unique proposal number')
}
