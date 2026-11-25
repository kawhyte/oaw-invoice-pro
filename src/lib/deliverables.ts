// ============================================================================
// Deliverable payment-gate logic — the single source of truth for whether a
// client may download the clean, print-ready original.
//
// Used by BOTH the owner project page (so the architect sees the true lock
// state) and the public share page (which actually enforces the gate by only
// emitting the original's URL when this returns true).
// ============================================================================

import { addDaysToDate, BUSINESS_TIMEZONE, daysBetween, todayInBusinessTz } from '@/lib/dates'
import type { DetailPage, ReviewLevel } from '@/types'

export interface GateDeliverable {
  manual_unlock: boolean
  linked_invoice_id: string | null
}

export interface GateInvoice {
  status: string
  amount_paid: number | null
  total: number
}

/**
 * Final is unlocked when the architect manually releases it, OR the linked
 * invoice is fully paid. An unlinked deliverable can only be opened manually.
 */
export function isFinalUnlocked(d: GateDeliverable, invoice?: GateInvoice | null): boolean {
  if (d.manual_unlock) return true
  if (!invoice) return false
  return invoice.status === 'paid' || Number(invoice.amount_paid ?? 0) >= Number(invoice.total)
}

// ---- Client review (before the final is unlocked) ---------------------------

export const MAX_REVIEW_DAYS = 365

const businessDate = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE }).format(new Date(iso))

/**
 * Review runs through the END of the last day in Jamaica (UTC-5, no DST), so
 * "available until Dec 2" means all of Dec 2. Extending adds to the time left.
 */
export function reviewExpiry(days: number, current?: string | null): string {
  const today = todayInBusinessTz()
  const from = current && Date.parse(current) > Date.now() ? lastReviewDay(current) : today
  return `${addDaysToDate(from, days + 1)}T05:00:00.000Z`
}

/** Last Jamaica calendar day a review is open (the expiry instant is exclusive). */
export function lastReviewDay(expiresAt: string): string {
  return businessDate(new Date(Date.parse(expiresAt) - 1000).toISOString())
}

export function reviewDaysLeft(expiresAt: string): number {
  return daysBetween(todayInBusinessTz(), lastReviewDay(expiresAt))
}

export interface ReviewDeliverable extends GateDeliverable {
  review_level: ReviewLevel
  review_expires_at: string | null
  allow_sample_download: boolean
  detail_pages: DetailPage[]
}

export interface ReviewAccess {
  /** The clean original may be downloaded. */
  final: boolean
  /** Any preview may be shown at all. */
  open: boolean
  /** Full-detail tiles may be served. */
  detail: boolean
  /** The watermarked sample PDF may be downloaded. */
  sample: boolean
}

/** What a client holding the share link may see right now. Paid/released drawings never expire. */
export function reviewAccess(d: ReviewDeliverable, invoice?: GateInvoice | null, now = Date.now()): ReviewAccess {
  const hasDetail = (d.detail_pages ?? []).length > 0
  if (isFinalUnlocked(d, invoice)) return { final: true, open: true, detail: hasDetail, sample: false }
  if (d.review_expires_at && Date.parse(d.review_expires_at) <= now) {
    return { final: false, open: false, detail: false, sample: false }
  }
  const detail = d.review_level === 'detail' && hasDetail
  return { final: false, open: true, detail, sample: detail && d.allow_sample_download }
}

/** Lifetime for basic preview links: never past the end of the review. */
export function previewLinkSeconds(access: ReviewAccess, expiresAt: string | null): number {
  if (access.final || !expiresAt) return 86400
  return Math.max(1, Math.min(3600, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)))
}
