import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument'
import React from 'react'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, projects(title, clients(name, email)), invoice_payments(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!invoice) return new Response('Not found', { status: 404 })

  const buffer = await renderToBuffer(React.createElement(InvoiceDocument, { invoice: invoice as any }) as React.ReactElement<any>)

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  })
}
