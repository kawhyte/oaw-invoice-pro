import 'server-only'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { and, eq, or, lt, lte, sql } from 'drizzle-orm'
import { db, payments, business_settings } from '@/db'
import { resolveLogoUrl } from '@/lib/storage'
import { ReceiptDocument, type ReceiptData } from '@/components/invoices/ReceiptDocument'
import type { BusinessSettings } from '@/types'

/**
 * Renders the receipt PDF for one payment. "Paid to date" counts only
 * payments up to and including this one (by date, then entry order), so a
 * receipt reads the same whenever it's re-downloaded. Returns null if the
 * payment isn't the user's or has no receipt (backfilled "earlier payments").
 */
export async function renderReceiptPdf(paymentId: string, userId: string): Promise<{ buffer: Buffer; receiptNumber: string } | null> {
  const [payment, bizSettings] = await Promise.all([
    db.query.payments.findFirst({
      where: and(eq(payments.id, paymentId), eq(payments.user_id, userId)),
      with: {
        invoices: {
          columns: { id: true, invoice_number: true, currency: true, total: true, project_id: true },
          with: {
            projects: { columns: { title: true }, with: { clients: { columns: { name: true, email: true } } } },
            clients: { columns: { name: true, email: true } },
            invoice_line_items: { columns: { project_id: true } },
          },
        },
      },
    }),
    db.query.business_settings.findFirst({ where: eq(business_settings.user_id, userId) }),
  ])
  if (!payment?.receipt_number || !payment.invoices) return null
  const inv = payment.invoices

  const [{ sum }] = await db.select({ sum: sql<string | null>`sum(${payments.amount})` }).from(payments).where(and(
    eq(payments.invoice_id, inv.id),
    or(
      lt(payments.paid_on, payment.paid_on),
      and(eq(payments.paid_on, payment.paid_on), lte(payments.created_at, payment.created_at)),
    ),
  ))

  const combinedCount = new Set(inv.invoice_line_items.map(li => li.project_id).filter(Boolean)).size
  const data: ReceiptData = {
    receipt_number: payment.receipt_number,
    amount: payment.amount,
    paid_on: payment.paid_on,
    method: payment.method,
    note: payment.note,
    currency: inv.currency,
    invoice_number: inv.invoice_number,
    invoice_total: inv.total,
    paid_to_date: Math.round(Number(sum ?? 0) * 100) / 100,
    client: inv.clients ?? inv.projects?.clients ?? null,
    for_label: inv.projects?.title ?? (combinedCount > 1 ? `Combined — ${combinedCount} projects` : null),
  }
  // Logos live in a private bucket — sign a short-lived URL for the PDF renderer.
  const biz = bizSettings ? ({ ...bizSettings, logo_url: await resolveLogoUrl(bizSettings.logo_url) } as BusinessSettings) : null

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(ReceiptDocument, { r: data, bizSettings: biz }) as any
  )
  return { buffer: Buffer.from(buffer), receiptNumber: payment.receipt_number }
}
