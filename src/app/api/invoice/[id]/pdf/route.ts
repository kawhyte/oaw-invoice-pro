import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument'
import React from 'react'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const [{ data: invoice }, { data: bizSettings }] = await Promise.all([
    supabase.from('invoices')
      .select('*, projects(title, job_type, location_address, clients(name, email)), invoice_line_items(*)')
      .eq('id', id).eq('user_id', user.id).single(),
    supabase.from('business_settings').select('*').eq('user_id', user.id).single(),
  ])

  if (!invoice) return new Response('Not found', { status: 404 })

  const buffer = await renderToBuffer(
    React.createElement(InvoiceDocument, { invoice: invoice as any, bizSettings: bizSettings ?? null }) as any
  )

  const url = new URL(request.url)
  const isPreview = url.searchParams.get('preview') === 'true'

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': isPreview
        ? `inline; filename="invoice-${invoice.invoice_number}.pdf"`
        : `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  })
}
