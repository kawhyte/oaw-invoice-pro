import { getUser } from '@/lib/session'
import { renderReceiptPdf } from '@/lib/receiptPdf'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!UUID.test(id)) return new Response('Not found', { status: 404 })

  const result = await renderReceiptPdf(id, user.id)
  if (!result) return new Response('Not found', { status: 404 })

  const inline = new URL(request.url).searchParams.get('preview') === 'true'
  return new Response(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${result.receiptNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
