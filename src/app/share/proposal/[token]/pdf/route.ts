import { renderProposalPdfByToken } from '@/lib/proposalPdf'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Public: the share token is the only credential, and only the latest SENT version is ever rendered.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!UUID.test(token)) return new Response('Not found', { status: 404 })
  const result = await renderProposalPdfByToken(token)
  if (!result) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
