import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

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
  supabase: SupabaseServer,
  invoiceId: string,
  userId: string
): Promise<{ buffer: Buffer; invoice: { invoice_number: string; project_id: string | null } } | null> {
  const [{ data: invoice }, { data: bizSettings }] = await Promise.all([
    supabase.from('invoices')
      .select('*, projects(title, job_type, location_address, clients(name, email)), clients(name, email), invoice_line_items(*)')
      .eq('id', invoiceId).eq('user_id', userId).single(),
    supabase.from('business_settings').select('*').eq('user_id', userId).single(),
  ])

  if (!invoice) return null

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(InvoiceDocument, { invoice: invoice as any, bizSettings: bizSettings ?? null }) as any
  )

  return { buffer: Buffer.from(buffer), invoice }
}
