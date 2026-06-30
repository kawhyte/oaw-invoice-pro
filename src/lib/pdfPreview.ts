'use client'
// ============================================================================
// On-device PDF -> watermarked preview rasterizer.
//
// For each page it produces TWO watermarked JPEGs:
//   * preview (~1000px) — shown inline on the share page; tiny, fast on slow
//     connections, lazy-loaded.
//   * zoom (~2000px)    — loaded only when the client taps to zoom in the
//     lightbox, so the initial page load stays light.
//
// Both are low-res, watermarked rasters — readable for review but useless for
// printing (a real plot is 7000px+), so the payment gate still holds. All work
// happens once, on the uploader's device, so nothing large hits a server.
// ============================================================================
import { pdfjs } from 'react-pdf'

// Match the worker source already used by InvoicePDFPreview.tsx.
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

export interface PreviewOptions {
  /** Inline preview width in CSS pixels. */
  previewWidth?: number
  /** High-res zoom width in CSS pixels (loaded on demand). */
  zoomWidth?: number
  /** JPEG quality 0–1. */
  quality?: number
  /** Watermark text stamped diagonally across every page. */
  watermarkText?: string
  /** Called after each page renders, for progress UI. */
  onProgress?: (done: number, total: number) => void
}

export interface PreviewResult {
  /** One inline-preview JPEG per page (small). */
  previews: Blob[]
  /** One high-res zoom JPEG per page (loaded on demand). */
  zooms: Blob[]
}

function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, text: string) {
  ctx.save()
  // Scale the stamp to the page so it reads on both small and large sheets.
  const fontSize = Math.max(18, Math.round(width / 22))
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.fillStyle = 'rgba(120, 120, 120, 0.18)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Rotate the whole canvas -30° and tile the text so it covers the page.
  ctx.translate(width / 2, height / 2)
  ctx.rotate((-30 * Math.PI) / 180)
  const stepX = ctx.measureText(text).width + fontSize * 4
  const stepY = fontSize * 5
  const reach = Math.ceil(Math.hypot(width, height) / 2)
  for (let y = -reach; y <= reach; y += stepY) {
    for (let x = -reach; x <= reach; x += stepX) {
      ctx.fillText(text, x, y)
    }
  }
  ctx.restore()
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Render every page to a watermarked high-res JPEG (zoom) and a downscaled
 * JPEG (preview). Pages are processed one at a time to keep memory bounded on
 * mobile, and each page is rendered from the PDF only once.
 */
export async function renderWatermarkedPreviews(
  file: File,
  opts: PreviewOptions = {}
): Promise<PreviewResult> {
  const {
    previewWidth = 1000,
    zoomWidth = 2000,
    quality = 0.7,
    watermarkText = 'DRAFT — NOT FOR PRINT',
    onProgress,
  } = opts

  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const previews: Blob[] = []
  const zooms: Blob[] = []

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: zoomWidth / base.width })

      // 1. Render the page once at zoom resolution, then watermark it.
      const zoomCanvas = document.createElement('canvas')
      zoomCanvas.width = Math.ceil(viewport.width)
      zoomCanvas.height = Math.ceil(viewport.height)
      const zoomCtx = zoomCanvas.getContext('2d')
      if (!zoomCtx) throw new Error('Could not get canvas context')
      await page.render({ canvasContext: zoomCtx, viewport, canvas: zoomCanvas }).promise
      drawWatermark(zoomCtx, zoomCanvas.width, zoomCanvas.height, watermarkText)

      const zoomBlob = await toJpegBlob(zoomCanvas, quality)
      if (!zoomBlob) throw new Error(`Failed to render page ${pageNum}`)
      zooms.push(zoomBlob)

      // 2. Derive the small inline preview by downscaling the same canvas.
      const prevW = previewWidth
      const prevH = Math.round((zoomCanvas.height * previewWidth) / zoomCanvas.width)
      const prevCanvas = document.createElement('canvas')
      prevCanvas.width = prevW
      prevCanvas.height = prevH
      const prevCtx = prevCanvas.getContext('2d')
      if (!prevCtx) throw new Error('Could not get canvas context')
      prevCtx.imageSmoothingQuality = 'high'
      prevCtx.drawImage(zoomCanvas, 0, 0, prevW, prevH)

      const prevBlob = await toJpegBlob(prevCanvas, quality)
      if (!prevBlob) throw new Error(`Failed to render page ${pageNum}`)
      previews.push(prevBlob)

      page.cleanup()
      onProgress?.(pageNum, pdf.numPages)
    }
  } finally {
    await pdf.destroy()
  }

  return { previews, zooms }
}
