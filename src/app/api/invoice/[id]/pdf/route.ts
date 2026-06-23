import { createClient } from '@/lib/supabase/server'
import { renderInvoicePdf } from '@/lib/invoicePdf'

export const runtime = 'nodejs'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const result = await renderInvoicePdf(supabase, id, user.id)
  if (!result) return new Response('Not found', { status: 404 })

  const url = new URL(request.url)
  const isPreview = url.searchParams.get('preview') === 'true'

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': isPreview
        ? `inline; filename="invoice-${result.invoice.invoice_number}.pdf"`
        : `attachment; filename="${result.invoice.invoice_number}.pdf"`,
    },
  })
}
