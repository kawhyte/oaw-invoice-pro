import { getUser } from '@/lib/session'
import { renderProposalPdf } from '@/lib/proposalPdf'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!UUID.test(id)) return new Response('Not found', { status: 404 })

  const url = new URL(request.url)
  const result = await renderProposalPdf(id, user.id, { draft: url.searchParams.get('draft') === 'true' })
  if (!result) return new Response('Not found', { status: 404 })

  const inline = url.searchParams.get('preview') === 'true'
  return new Response(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${result.fileName}"`,
    },
  })
}
