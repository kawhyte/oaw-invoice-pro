import { signedGetUrl } from '@/lib/storage'
import { sharedDrawing } from '@/lib/shareDrawing'

export const runtime = 'nodejs'

// Tile links are signed on demand and die within minutes, so a review that has
// ended (or been switched off) stops serving detail almost immediately.
const TILE_URL_SECONDS = 300

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; id: string; page: string }> }) {
  const { token, id, page } = await params
  const noStore = { 'Cache-Control': 'private, no-store' }
  const found = await sharedDrawing(token, id)
  const detail = /^\d{1,3}$/.test(page) ? found?.d.detail_pages?.[Number(page)] : undefined
  if (!found || !detail) return new Response('Not found', { status: 404, headers: noStore })
  if (!found.access.detail) return new Response('Review ended', { status: 403, headers: noStore })
  const urls = await Promise.all(detail.tiles.map(k => signedGetUrl(k, TILE_URL_SECONDS)))
  return Response.json({ urls }, { headers: noStore })
}
