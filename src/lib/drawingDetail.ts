// Geometry shared by the on-device tile builder, the server actions, the zoom
// viewer and the sample-PDF writer. Pure — safe in client and server bundles.
import type { DetailPage } from '@/types'

/** Tile edge in px. Few, largish tiles: each view is a billable-class storage
 *  read (2,500/day free), so ~6 per sheet instead of hundreds. */
export const DETAIL_TILE = 1800

/** 150 dpi, but never under 5400px on the long edge (drawings are often exported
 *  shrunk onto A4/A3) and never over 7200px. */
export const DETAIL_DPI = 150
const DETAIL_MIN_EDGE = 5400
export const DETAIL_MAX_EDGE = 7200

/** Full-detail pixel size for a page given in PDF points. */
export function detailSize(widthPt: number, heightPt: number): { width: number; height: number; scale: number } {
  const long = Math.max(widthPt, heightPt)
  const edge = Math.min(DETAIL_MAX_EDGE, Math.max(DETAIL_MIN_EDGE, (long / 72) * DETAIL_DPI))
  const scale = edge / long
  return { width: Math.max(1, Math.round(widthPt * scale)), height: Math.max(1, Math.round(heightPt * scale)), scale }
}

export interface TileRect { x: number; y: number; w: number; h: number }

/** Tile rectangles, left-to-right then top-to-bottom. */
export function detailGrid(width: number, height: number, tile: number): TileRect[] {
  const rects: TileRect[] = []
  for (let y = 0; y < height; y += tile) {
    for (let x = 0; x < width; x += tile) {
      rects.push({ x, y, w: Math.min(tile, width - x), h: Math.min(tile, height - y) })
    }
  }
  return rects
}

/** Every storage key behind a drawing's full-detail version. */
export function detailKeys(pages: DetailPage[] | null | undefined): string[] {
  return (Array.isArray(pages) ? pages : []).flatMap(p => p.tiles ?? [])
}
