import 'server-only'
import { and, eq, like, sql } from 'drizzle-orm'
import { invoices, payments } from '@/db'
import { computeStatus, round2 } from '@/lib/invoiceCalc'
import { pgErrorCode, type Exec } from '@/lib/invoiceNumbering'
import type { PaymentMethod } from '@/types'

// Payment ledger helpers shared by invoice server actions. Not a 'use server'
// file: every export of one becomes a publicly callable endpoint.

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'bank_transfer', 'cheque', 'card', 'other']

/** Next RCT-### for a user, from the MAX existing number so deletions never free one for reuse. */
async function nextReceiptNumber(exec: Exec, userId: string): Promise<string> {
  const rows = await exec.select({ n: payments.receipt_number }).from(payments)
    .where(and(eq(payments.user_id, userId), like(payments.receipt_number, 'RCT-%')))
  let max = 0
  for (const r of rows) {
    const m = /^RCT-0*(\d+)$/.exec(r.n ?? '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `RCT-${String(max + 1).padStart(3, '0')}`
}

/**
 * Recomputes an invoice's amount_paid from its payments and updates its
 * status to match. Call inside the same transaction as any payment change so
 * amount_paid always equals SUM(payments.amount).
 */
export async function syncInvoicePaid(exec: Exec, invoiceId: string, userId: string): Promise<void> {
  const [inv] = await exec.select({ total: invoices.total, due_date: invoices.due_date, status: invoices.status })
    .from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.user_id, userId))).limit(1)
  if (!inv) throw new Error('Not found')
  const [{ sum }] = await exec.select({ sum: sql<string | null>`sum(${payments.amount})` })
    .from(payments).where(eq(payments.invoice_id, invoiceId))
  const amountPaid = round2(Number(sum ?? 0))
  const status = computeStatus({ amountPaid, total: inv.total, dueDate: inv.due_date, wasSent: inv.status !== 'draft' })
  await exec.update(invoices).set({ amount_paid: amountPaid, status })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.user_id, userId)))
}

export type NewPayment = { amount: number; paid_on: string; method: PaymentMethod | null; note: string | null }

/**
 * Inserts a payment with a unique receipt number (retrying if a concurrent
 * insert took the same number) and re-syncs the invoice. Run inside a
 * transaction; the invoice must already be verified as the user's.
 */
export async function insertPayment(
  exec: Exec, userId: string, invoiceId: string, p: NewPayment,
): Promise<{ id: string; receipt_number: string }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const receipt_number = await nextReceiptNumber(exec, userId)
    try {
      const row = await exec.transaction(async (sp) => {
        const [r] = await sp.insert(payments).values({
          user_id: userId, invoice_id: invoiceId, receipt_number,
          amount: round2(p.amount), paid_on: p.paid_on, method: p.method, note: p.note,
        }).returning({ id: payments.id, receipt_number: payments.receipt_number })
        return r
      })
      await syncInvoicePaid(exec, invoiceId, userId)
      return { id: row.id, receipt_number: row.receipt_number! }
    } catch (err) {
      if (pgErrorCode(err) !== '23505') throw err
    }
  }
  throw new Error('Could not allocate a receipt number — please try again')
}

/** Validates user input for a new payment. Throws a readable error. */
export function parsePayment(input: { amount: unknown; paid_on: unknown; method: unknown; note: unknown }): NewPayment {
  const amount = round2(Number(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than 0')
  const paid_on = String(input.paid_on ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paid_on) || Number.isNaN(Date.parse(paid_on))) throw new Error('Pick a valid payment date')
  const method = PAYMENT_METHODS.includes(input.method as PaymentMethod) ? (input.method as PaymentMethod) : null
  const note = typeof input.note === 'string' && input.note.trim() ? input.note.trim().slice(0, 300) : null
  return { amount, paid_on, method, note }
}
