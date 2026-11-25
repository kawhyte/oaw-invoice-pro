import { getObject } from '@/lib/storage'
import { safeFileName, sharedDrawing } from '@/lib/shareDrawing'
import { samplePdf } from '@/lib/samplePdf'

export const runtime = 'nodejs'
export const maxDuration = 300

// Flattened, watermarked review copy: built from the same watermarked tiles the
// viewer shows, so the clean original is never involved.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params
  const found = await sharedDrawing(token, id)
  if (!found) return new Response('Not found', { status: 404 })
  if (!found.access.sample) {
    return new Response('This sample is no longer available. Please contact us to view it again.', { status: 403 })
  }
  const chunks = samplePdf(found.d.detail_pages, async key => (await getObject(key))?.body ?? null)
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await chunks.next()
        if (done) controller.close()
        else controller.enqueue(value)
      } catch (err) {
        console.error('[sample-pdf]', err)
        controller.error(err)
      }
    },
    cancel() { void chunks.return(undefined) },
  })
  const name = `${safeFileName(found.projectTitle)} - ${safeFileName(found.d.name)} - SAMPLE.pdf`
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
