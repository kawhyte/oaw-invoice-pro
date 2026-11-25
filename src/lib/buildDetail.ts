'use client'
import { renderDetailTiles } from '@/lib/pdfPreview'
import { uploadToUrl } from '@/lib/uploadToUrl'
import { createDetailUploadAction, discardDetailAction, saveDetailAction } from '@/app/(dashboard)/projects/[id]/actions'

/** Builds a drawing's watermarked full-detail version on this device, from the
 *  original already in storage — no re-upload, so it works on old drawings too. */
export async function buildDetail(
  projectId: string, deliverableId: string, watermarkText: string, onProgress: (msg: string) => void,
): Promise<void> {
  onProgress('Getting the drawing…')
  const res = await fetch(`/api/deliverable/${deliverableId}/original`)
  if (!res.ok) throw new Error('Couldn’t get the original drawing. Check your connection and try again.')
  const source = await res.arrayBuffer()

  const runId = crypto.randomUUID()
  const pages: { width: number; height: number }[] = []
  onProgress('Preparing full detail…')
  try {
    await renderDetailTiles(source, watermarkText, async ({ index, total, width, height, tiles }) => {
      onProgress(`Uploading full detail ${index + 1}/${total}…`)
      pages.push({ width, height })
      const urls = await createDetailUploadAction(projectId, deliverableId, runId, {
        index, width, height, sizes: tiles.map(t => t.size),
      })
      for (let i = 0; i < urls.length; i++) await uploadToUrl(urls[i], tiles[i], 'image/jpeg')
      if (index + 1 < total) onProgress(`Preparing full detail ${index + 2}/${total}…`)
    })
    await saveDetailAction(projectId, deliverableId, runId, pages)
  } catch (err) {
    if (pages.length > 0) await discardDetailAction(projectId, deliverableId, runId, pages).catch(() => {})
    throw err
  }
}
