import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDocument } from '@/components/invoices/InvoiceDocument'
import React from 'react'

export const runtime = 'nodejs'

// Invoice fields (client name, project title, notes) are user-entered text
// and get interpolated into the email HTML — escape them.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Best-effort per-user rate limit. Module scope survives across requests on a
// warm serverless instance; a cold start resets it, which is acceptable — the
// goal is stopping accidental rapid-fire sends, not adversarial abuse (the
// route already requires an authenticated session).
const sendTimes = new Map<string, number[]>()
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const now = Date.now()
  const recent = (sendTimes.get(user.id) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) {
    return Response.json({ error: 'Too many emails — wait a minute and try again.' }, { status: 429 })
  }
  recent.push(now)
  sendTimes.set(user.id, recent)

  const [{ data: invoice }, { data: bizSettings }] = await Promise.all([
    supabase.from('invoices')
      .select('*, projects(title, job_type, location_address, clients(name, email)), clients(name, email), invoice_line_items(*)')
      .eq('id', id).eq('user_id', user.id).single(),
    supabase.from('business_settings').select('*').eq('user_id', user.id).single(),
  ])

  if (!invoice) return new Response('Not found', { status: 404 })
  const client = (invoice.projects as any)?.clients ?? (invoice.clients as any)
  if (!client?.email) return Response.json({ error: 'Client has no email address' }, { status: 400 })

  const buffer = await renderToBuffer(
    React.createElement(InvoiceDocument, { invoice: invoice as any, bizSettings: bizSettings ?? null }) as any
  )

  const fmt = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n)
  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromName = bizSettings?.business_name ?? 'OW Studio'

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
    to: process.env.RESEND_TO_OVERRIDE || client.email,
    subject: `Invoice ${invoice.invoice_number} — ${fmt(invoice.total, invoice.currency)}`,
    html: `
      <p>Hi ${escapeHtml(client.name)},</p>
      <p>Please find your invoice <strong>${escapeHtml(invoice.invoice_number)}</strong> attached${(invoice.projects as any)?.title ? ` for the project <strong>${escapeHtml((invoice.projects as any).title)}</strong>` : ''}.</p>
      <p><strong>Total: ${fmt(invoice.total, invoice.currency)}</strong></p>
      ${invoice.notes ? `<p><em>${escapeHtml(invoice.notes)}</em></p>` : ''}
      <p>Please reach out if you have any questions.</p>
      <p>— ${escapeHtml(fromName)}</p>
    `,
    attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(buffer) }],
  })

  if (error) {
    console.error('Resend error:', JSON.stringify(error))
    return Response.json({ error }, { status: 500 })
  }
  return Response.json({ ok: true })
}
