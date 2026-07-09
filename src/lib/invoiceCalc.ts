import type { DiscountType, InvoiceStatus } from '@/types'
import { todayInBusinessTz } from '@/lib/dates'

/**
 * Single source of truth for invoice money math.
 * Used by server actions, the invoice form preview, and the PDF document so the
 * three never drift. All monetary results are rounded to 2 decimals to avoid
 * floating-point artifacts (e.g. 0.1 + 0.2).
 */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface LineItemInput {
  quantity: number
  unit_price: number
}

/** Sum of (quantity × unit_price) across line items, rounded per line then summed. */
export function lineSubtotal(items: LineItemInput[]): number {
  return round2(items.reduce((sum, i) => sum + round2((i.quantity || 0) * (i.unit_price || 0)), 0))
}

export interface TotalsInput {
  subtotal: number
  discountType: DiscountType
  discountValue: number
  /** 0 or 0.15 */
  gctRate: number
  additionsAmount: number
}

export interface Totals {
  discountAmount: number
  afterDiscount: number
  gctAmount: number
  total: number
}

/**
 * Mirrors the original formula exactly: discount first, GCT applied on the
 * discounted amount, additions added last.
 */
export function computeTotals({
  subtotal,
  discountType,
  discountValue,
  gctRate,
  additionsAmount,
}: TotalsInput): Totals {
  const discountAmount = round2(
    discountType === 'percentage'
      ? subtotal * ((discountValue || 0) / 100)
      : discountType === 'fixed'
        ? discountValue || 0
        : 0
  )
  const afterDiscount = round2(subtotal - discountAmount)
  const gctAmount = round2(afterDiscount * (gctRate || 0))
  const total = round2(afterDiscount + gctAmount + (additionsAmount || 0))
  return { discountAmount, afterDiscount, gctAmount, total }
}

export interface StatusInput {
  amountPaid: number
  total: number
  dueDate: string | null
  wasSent: boolean
}

export function computeStatus({ amountPaid, total, dueDate, wasSent }: StatusInput): InvoiceStatus {
  if (total > 0 && amountPaid >= total) return 'paid'
  // Partial wins over overdue: "some money came in" is the more actionable
  // signal on a row, and overdue money is independently computed from
  // due_date on the dashboard (OverdueAlert / stats), so it is never lost.
  if (amountPaid > 0) return 'partial'
  const today = todayInBusinessTz()
  if (dueDate && dueDate < today) return 'overdue'
  if (wasSent) return 'sent'
  return 'draft'
}

/** Discount amount only — for display contexts (PDF) that have stored totals. */
export function discountAmountFor(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number
): number {
  return round2(
    discountType === 'percentage'
      ? subtotal * ((discountValue || 0) / 100)
      : discountType === 'fixed'
        ? discountValue || 0
        : 0
  )
}
