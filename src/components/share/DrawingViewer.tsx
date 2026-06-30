'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'

export interface DrawingPage {
  /** Small inline preview (~1000px). */
  preview: string
  /** High-res image (~2000px) loaded only when the lightbox opens. */
  zoom: string
}

interface Props { name: string; pages: DrawingPage[] }

const MAX_SCALE = 4
const MIN_SCALE = 1

export function DrawingViewer({ name, pages }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const resetView = useCallback(() => { setScale(1); setPos({ x: 0, y: 0 }) }, [])

  const close = useCallback(() => { setOpenIndex(null); resetView() }, [resetView])
  const go = useCallback((next: number) => {
    setOpenIndex(i => {
      if (i === null) return i
      const n = Math.max(0, Math.min(pages.length - 1, next))
      return n
    })
    resetView()
  }, [pages.length, resetView])

  // Keyboard controls while the lightbox is open.
  useEffect(() => {
    if (openIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') go((openIndex ?? 0) + 1)
      else if (e.key === 'ArrowLeft') go((openIndex ?? 0) - 1)
    }
    window.addEventListener('keydown', onKey)
    // Lock background scroll while open.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [openIndex, close, go])

  function zoomBy(delta: number) {
    setScale(s => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2)))
      if (next === 1) setPos({ x: 0, y: 0 })
      return next
    })
  }

  function toggleZoom() {
    setScale(s => {
      if (s > 1) { setPos({ x: 0, y: 0 }); return 1 }
      return 2.5
    })
  }

  function onPointerDown(e: React.PointerEvent) {
    if (scale <= 1) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    setPos({ x: dragRef.current.px + (e.clientX - dragRef.current.x), y: dragRef.current.py + (e.clientY - dragRef.current.y) })
  }
  function onPointerUp() { dragRef.current = null }

  const open = openIndex !== null
  const current = open ? pages[openIndex!] : null

  return (
    <>
      {/* Inline preview stack — tap any page to open the zoom viewer. */}
      <div className="space-y-3">
        {pages.map((p, i) => (
          <button key={i} type="button" onClick={() => { setOpenIndex(i); resetView() }}
            className="block w-full group relative cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt={`${name} — page ${i + 1}`} loading="lazy"
              className="w-full rounded-lg border border-[#e0e0e3] transition group-hover:border-[#715a3e]" />
            <span className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/55 text-white text-xs opacity-0 group-hover:opacity-100 transition">
              <ZoomIn className="w-3 h-3" /> Tap to zoom
            </span>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {open && current && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" role="dialog" aria-modal="true" aria-label={`${name} viewer`}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
            <span className="text-sm truncate">{name} · page {openIndex! + 1} of {pages.length}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => zoomBy(-0.5)} aria-label="Zoom out" className="p-2 rounded-md hover:bg-white/15"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => zoomBy(0.5)} aria-label="Zoom in" className="p-2 rounded-md hover:bg-white/15"><ZoomIn className="w-5 h-5" /></button>
              <button onClick={close} aria-label="Close" className="p-2 rounded-md hover:bg-white/15"><X className="w-5 h-5" /></button>
            </div>
          </div>

          {/* Image stage */}
          <div className="relative flex-1 overflow-hidden flex items-center justify-center select-none touch-pan-y">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.zoom || current.preview}
              alt={`${name} — page ${openIndex! + 1}`}
              draggable={false}
              onClick={toggleZoom}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, cursor: scale > 1 ? 'grab' : 'zoom-in' }}
              className="max-h-full max-w-full object-contain transition-transform duration-100 will-change-transform"
            />

            {/* Prev / Next */}
            {openIndex! > 0 && (
              <button onClick={() => go(openIndex! - 1)} aria-label="Previous page"
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60">
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {openIndex! < pages.length - 1 && (
              <button onClick={() => go(openIndex! + 1)} aria-label="Next page"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60">
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          <p className="text-center text-white/60 text-xs py-2 shrink-0">Tap the image to zoom · drag to pan · pinch to zoom on mobile</p>
        </div>
      )}
    </>
  )
}
