import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument'
import { resolveLogoUrl } from '@/lib/storage'
import { and, eq } from 'drizzle-orm'
import { db, invoices, business_settings, invoice_line_items } from '@/db'
import type { BusinessSettings } from '@/types'

/**
 * Fetches an invoice (with its projects, clients and line items) plus the
 * owner's business settings, and renders the PDF to a Buffer.
 *
 * Single source of truth for invoice PDF generation so the download/preview
 * route (`/api/invoice/[id]/pdf`) and the "Save for client" server action
 * produce a byte-identical document. Returns null if the invoice isn't found
 * for this user.
 */
export async function renderInvoicePdf(
  invoiceId: string,
  userId: string
): Promise<{ buffer: Buffer; invoice: { invoice_number: string; project_id: string | null } } | null> {
  const [invoice, bizSettings] = await Promise.all([
    db.query.invoices.findFirst({
      where: and(eq(invoices.id, invoiceId), eq(invoices.user_id, userId)),
      with: {
        projects: {
          columns: { title: true, job_type: true, location_address: true },
          with: { clients: { columns: { name: true, email: true } } },
        },
        clients: { columns: { name: true, email: true } },
        invoice_line_items: { orderBy: invoice_line_items.sort_order },
      },
    }),
    db.query.business_settings.findFirst({ where: eq(business_settings.user_id, userId) }),
  ])

  if (!invoice) return null
  // Logos live in a private bucket — sign a short-lived URL for the PDF renderer.
  const biz = bizSettings ? ({ ...bizSettings, logo_url: await resolveLogoUrl(bizSettings.logo_url) } as BusinessSettings) : null

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(InvoiceDocument, { invoice: invoice as any, bizSettings: biz }) as any
  )

  return { buffer: Buffer.from(buffer), invoice }
}
