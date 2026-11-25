import { detailGrid } from '@/lib/drawingDetail'
import type { DetailPage } from '@/types'

// Minimal streaming PDF writer: each page is just its JPEG tiles placed edge to
// edge (JPEG bytes go in untouched via DCTDecode). Streaming keeps memory to
// about one page of tiles however long the drawing set is.

const PT_PER_PX = 72 / 150

export async function* samplePdf(
  pages: DetailPage[], loadTile: (key: string) => Promise<Uint8Array | null>,
): AsyncGenerator<Uint8Array, void, undefined> {
  const enc = new TextEncoder()
  const offsets: number[] = [] // index = object number
  let pos = 0
  const emit = (b: Uint8Array) => { pos += b.length; return b }
  const text = (s: string) => emit(enc.encode(s))
  const begin = (n: number, body: string) => { offsets[n] = pos; return text(`${n} 0 obj\n${body}`) }

  yield text('%PDF-1.4\n')
  yield begin(1, '<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  let next = 3
  const pageIds: number[] = []

  for (const page of pages) {
    const rects = detailGrid(page.width, page.height, page.tile)
    const imageIds: number[] = []
    const pending = page.tiles.map(k => loadTile(k))
    // A tile that fails is reported when its turn comes, not as an unhandled rejection.
    pending.forEach(p => p.catch(() => {}))
    for (let i = 0; i < rects.length; i++) {
      const bytes = await pending[i]
      if (!bytes) throw new Error(`Missing tile ${page.tiles[i]}`)
      const id = next++
      imageIds.push(id)
      yield begin(id, `<< /Type /XObject /Subtype /Image /Width ${rects[i].w} /Height ${rects[i].h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`)
      yield emit(bytes)
      yield text('\nendstream\nendobj\n')
    }
    const pt = (n: number) => (n * PT_PER_PX).toFixed(3)
    // One extra pixel right/down hides hairline seams some PDF viewers draw between images.
    const content = rects.map((r, i) =>
      `q ${pt(r.w + 1)} 0 0 ${pt(r.h + 1)} ${pt(r.x)} ${pt(page.height - r.y - r.h - 1)} cm /I${i} Do Q`).join('\n')
    const contentId = next++
    yield begin(contentId, `<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)
    const pageId = next++
    pageIds.push(pageId)
    const images = imageIds.map((id, i) => `/I${i} ${id} 0 R`).join(' ')
    yield begin(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(page.width)} ${pt(page.height)}] /Resources << /XObject << ${images} >> >> /Contents ${contentId} 0 R >>\nendobj\n`)
  }

  yield begin(2, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\nendobj\n`)
  const xref = pos
  const rows = Array.from({ length: next - 1 }, (_, i) => `${String(offsets[i + 1]).padStart(10, '0')} 00000 n \n`).join('')
  yield text(`xref\n0 ${next}\n0000000000 65535 f \n${rows}trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
}
