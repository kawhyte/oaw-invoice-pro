import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument'
import React from 'react'

export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const client = (invoice.projects as any)?.clients
  if (!client?.email) return Response.json({ error: 'Client has no email address' }, { status: 400 })

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(React.createElement(InvoiceDocument, { invoice: invoice as any }))
  } catch (err) {
    console.error('[email] PDF render failed:', err)
    return Response.json({ error: 'Failed to render PDF', detail: String(err) }, { status: 500 })
  }

  const fmt = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n)

  const resend = new Resend(process.env.RESEND_API_KEY)
  const toAddress = process.env.RESEND_TO_OVERRIDE ?? client.email

  let sendResult: Awaited<ReturnType<typeof resend.emails.send>>
  try {
    sendResult = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
      to: toAddress,
      subject: `Invoice ${invoice.invoice_number} — ${fmt(invoice.total, invoice.currency)}`,
      html: `
        <p>Hi ${client.name},</p>
        <p>Please find your invoice <strong>${invoice.invoice_number}</strong> attached for the project <strong>${(invoice.projects as any)?.title}</strong>.</p>
        <p><strong>Total: ${fmt(invoice.total, invoice.currency)}</strong></p>
        ${invoice.notes ? `<p><em>${invoice.notes}</em></p>` : ''}
        <p>Please reach out if you have any questions.</p>
      `,
      attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(buffer) }],
    })
  } catch (err) {
    console.error('[email] Resend send failed:', err)
    return Response.json({ error: 'Failed to send email', detail: String(err) }, { status: 500 })
  }

  if (sendResult.error) {
    console.error('[email] Resend API error:', sendResult.error)
    return Response.json({ error: sendResult.error }, { status: 500 })
  }
  return Response.json({ ok: true })
}
