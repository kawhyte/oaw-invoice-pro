'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { detailGrid } from '@/lib/drawingDetail'

export interface DrawingPage {
  /** Small inline preview (~1000px). */
  preview: string
  /** High-res image (~2000px) loaded only when the lightbox opens. */
  zoom: string
  /** Full-detail tiles, when the owner has switched them on. `src` returns short-lived tile links. */
  detail?: { width: number; height: number; tile: number; src: string }
}

interface Props { name: string; pages: DrawingPage[] }

export function DrawingViewer({ name, pages }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const close = useCallback(() => setOpenIndex(null), [])
  const go = useCallback((step: number) => {
    setOpenIndex(i => i === null ? i : Math.max(0, Math.min(pages.length - 1, i + step)))
  }, [pages.length])
  const open = openIndex !== null

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, close, go])

  return (
    <>
      <div className="space-y-3">
        {pages.map((p, i) => (
          <button key={i} type="button" onClick={() => setOpenIndex(i)} className="block w-full group relative cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt={`${name} — page ${i + 1}`} loading="lazy"
              className="w-full rounded-lg border border-[#e0e0e3] transition group-hover:border-[#715a3e]" />
            <span className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/55 text-white text-xs">
              <ZoomIn className="w-3 h-3" /> {p.detail ? 'Open full detail' : 'Tap to zoom'}
            </span>
          </button>
        ))}
      </div>

      {open && pages[openIndex] && (
        <div className="fixed inset-0 m-0! z-[60] bg-[#1a1c1e]" role="dialog" aria-modal="true" aria-label={`${name} viewer`}>
          <ZoomStage key={openIndex} page={pages[openIndex]} name={name} index={openIndex} total={pages.length} onClose={close} onGo={go} />
        </div>
      )}
    </>
  )
}

interface View { s: number; x: number; y: number }
interface Size { w: number; h: number }

const MIN_SCALE = 1
const DOUBLE_TAP_MS = 300
// Links last 5 minutes; stop trusting a batch a little earlier.
const TILE_LINK_MS = 4 * 60 * 1000

/** One page, map-style: pinch / wheel / double-tap / buttons to zoom, drag to pan. */
function ZoomStage({ page, name, index, total, onClose, onGo }: {
  page: DrawingPage; name: string; index: number; total: number; onClose: () => void; onGo: (step: number) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Size>({ w: 0, h: 0 })
  const [natural, setNatural] = useState<Size | null>(page.detail ? { w: page.detail.width, h: page.detail.height } : null)
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({ moved: false, lastTap: 0, tapX: 0, tapY: 0 })

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The whole page fitted in the stage is scale 1.
  const fit = natural && box.w && box.h ? Math.min(box.w / natural.w, box.h / natural.h) : 0
  const base: Size = natural ? { w: natural.w * fit, h: natural.h * fit } : { w: 0, h: 0 }
  // Zoom in until one image pixel covers about two screen points.
  const maxScale = fit ? Math.max(4, 2 / fit) : 4

  const clamp = useCallback((v: View): View => {
    const s = Math.min(maxScale, Math.max(MIN_SCALE, v.s))
    const limX = Math.max(0, (base.w * s - box.w) / 2)
    const limY = Math.max(0, (base.h * s - box.h) / 2)
    return { s, x: Math.min(limX, Math.max(-limX, v.x)), y: Math.min(limY, Math.max(-limY, v.y)) }
  }, [maxScale, base.w, base.h, box.w, box.h])

  /** Zoom by a factor keeping the point (px,py — from stage centre) still. */
  const zoomAt = useCallback((factor: number, px: number, py: number, dx = 0, dy = 0) => {
    setView(v => {
      const s = Math.min(maxScale, Math.max(MIN_SCALE, v.s * factor))
      const k = s / v.s
      return clamp({ s, x: px - (px - v.x) * k + dx, y: py - (py - v.y) * k + dy })
    })
  }, [clamp, maxScale])

  const fromCentre = useCallback((clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 }
  }, [])

  // React attaches wheel listeners passively; this one must block page scroll/zoom.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const p = fromCentre(e.clientX, e.clientY)
      const unit = e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 400 : 1
      // ctrlKey = trackpad pinch, which reports much smaller deltas.
      zoomAt(Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.002)), p.x, p.y)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [fromCentre, zoomAt])

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    stageRef.current?.setPointerCapture(e.pointerId)
    if (pointers.current.size === 0) gesture.current.moved = false
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size > 1) gesture.current.moved = true
  }

  function onPointerMove(e: React.PointerEvent) {
    const map = pointers.current
    const prev = map.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    if (map.size === 1) {
      // Ignore the jitter of a tap until it is clearly a drag.
      if (!gesture.current.moved && Math.hypot(cur.x - prev.x, cur.y - prev.y) < 6) return
      gesture.current.moved = true
      map.set(e.pointerId, cur)
      setView(v => clamp({ s: v.s, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y }))
      return
    }
    const other = [...map].find(([id]) => id !== e.pointerId)![1]
    map.set(e.pointerId, cur)
    const before = Math.hypot(prev.x - other.x, prev.y - other.y)
    const after = Math.hypot(cur.x - other.x, cur.y - other.y)
    if (before < 1) return
    const mid = fromCentre((prev.x + other.x) / 2, (prev.y + other.y) / 2)
    zoomAt(after / before, mid.x, mid.y, (cur.x - prev.x) / 2, (cur.y - prev.y) / 2)
  }

  function onPointerUp(e: React.PointerEvent) {
    const had = pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (!had || g.moved || e.type === 'pointercancel' || pointers.current.size > 0) return
    const now = e.timeStamp
    const p = fromCentre(e.clientX, e.clientY)
    if (now - g.lastTap < DOUBLE_TAP_MS && Math.hypot(p.x - g.tapX, p.y - g.tapY) < 40) {
      g.lastTap = 0
      if (view.s > 1.05) setView({ s: 1, x: 0, y: 0 })
      else zoomAt(Math.min(maxScale, 4), p.x, p.y)
    } else {
      g.lastTap = now; g.tapX = p.x; g.tapY = p.y
    }
  }

  const v = clamp(view) // keeps the page in bounds after a rotate/resize
  const w = base.w * v.s
  const h = base.h * v.s
  const left = (box.w - w) / 2 + v.x
  const top = (box.h - h) / 2 + v.y
  const btn = 'p-2.5 rounded-md hover:bg-white/15 disabled:opacity-30'

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 text-white shrink-0">
        <span className="text-sm truncate">{name} · page {index + 1} of {total}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => zoomAt(1 / 1.6, 0, 0)} disabled={v.s <= MIN_SCALE} aria-label="Zoom out" className={btn}><ZoomOut className="w-5 h-5" /></button>
          <button onClick={() => zoomAt(1.6, 0, 0)} disabled={v.s >= maxScale} aria-label="Zoom in" className={btn}><ZoomIn className="w-5 h-5" /></button>
          <button onClick={onClose} aria-label="Close" className={btn}><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={stageRef} data-testid="drawing-stage"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onContextMenu={e => e.preventDefault()}
          style={{ touchAction: 'none', cursor: v.s > 1 ? 'grab' : 'zoom-in' }}
          className="absolute inset-0 overflow-hidden select-none">
          <div className="absolute top-0 left-0" style={{ width: w, height: h, transform: `translate(${left}px, ${top}px)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={page.zoom || page.preview} alt={`${name} — page ${index + 1}`} draggable={false}
              onLoad={e => { const i = e.currentTarget; if (!natural) setNatural({ w: i.naturalWidth, h: i.naturalHeight }) }}
              className="absolute inset-0 w-full h-full max-w-none" style={{ WebkitTouchCallout: 'none' }} />
            {page.detail && fit > 0 && (
              <DetailTiles detail={page.detail} pageW={w} left={left} top={top} box={box} />
            )}
          </div>
        </div>

        {index > 0 && (
          <button onClick={() => onGo(-1)} aria-label="Previous page"
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronLeft className="w-6 h-6" /></button>
        )}
        {index < total - 1 && (
          <button onClick={() => onGo(1)} aria-label="Next page"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronRight className="w-6 h-6" /></button>
        )}
      </div>

      <p className="text-center text-white/70 text-xs py-2 shrink-0">
        <span className="hidden pointer-coarse:inline">Pinch or double-tap to zoom · drag to move</span>
        <span className="pointer-coarse:hidden">Scroll or double-click to zoom · drag to move</span>
      </p>
    </div>
  )
}

/** Sharp tiles over the base image: only those in view, only once zoomed past what the base can show. */
function DetailTiles({ detail, pageW, left, top, box }: {
  detail: NonNullable<DrawingPage['detail']>; pageW: number; left: number; top: number; box: Size
}) {
  const [shown, setShown] = useState<Record<number, string>>({})
  const [notice, setNotice] = useState<'' | 'ended' | 'error'>('')
  const [retry, setRetry] = useState(0)
  const links = useRef<{ urls: string[]; at: number } | null>(null)
  const fails = useRef(0)

  const k = pageW / detail.width // screen px per image px
  const rects = detailGrid(detail.width, detail.height, detail.tile)
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const sharpNeeded = pageW * dpr > 1400
  const wanted = !sharpNeeded ? [] : rects.flatMap((r, i) => {
    const x = left + r.x * k, y = top + r.y * k
    return x < box.w && y < box.h && x + r.w * k > 0 && y + r.h * k > 0 && !shown[i] ? [i] : []
  })
  const wantedKey = wanted.join(',')

  useEffect(() => {
    if (!wantedKey || notice === 'ended') return
    let cancelled = false
    // Wait for the gesture to settle so a quick pinch doesn't fetch tiles it flies past.
    const t = setTimeout(async () => {
      try {
        if (!links.current || Date.now() - links.current.at > TILE_LINK_MS) {
          const res = await fetch(detail.src, { cache: 'no-store' })
          if (cancelled) return
          if (res.status === 403 || res.status === 404) { setNotice('ended'); return }
          if (!res.ok) throw new Error(String(res.status))
          links.current = { urls: (await res.json()).urls, at: Date.now() }
        }
        if (cancelled) return
        const { urls } = links.current
        setShown(s => ({ ...s, ...Object.fromEntries(wantedKey.split(',').map(i => [i, urls[Number(i)]])) }))
      } catch {
        if (!cancelled) setNotice('error')
      }
    }, 120)
    return () => { cancelled = true; clearTimeout(t) }
  }, [wantedKey, detail.src, notice, retry])

  function onTileError(i: number) {
    links.current = null
    if (++fails.current > 4) { setNotice('error'); return }
    setShown(s => { const n = { ...s }; delete n[i]; return n })
    setRetry(n => n + 1)
  }

  return (
    <>
      {rects.map((r, i) => shown[i] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={shown[i]} alt="" draggable={false} data-tile={i}
          onLoad={() => { fails.current = 0; setNotice(n => n === 'error' ? '' : n) }} onError={() => onTileError(i)}
          className="absolute max-w-none" style={{ left: r.x * k, top: r.y * k, width: r.w * k, height: r.h * k, WebkitTouchCallout: 'none' }} />
      ))}
      {notice && (
        <div className="absolute z-10 flex justify-center pointer-events-none" style={{ left: -left, top: -top, width: box.w }}>
          <p className="m-3 px-3 py-2 rounded-lg bg-black/80 text-white text-xs">
            {notice === 'ended' ? 'This review has ended. Contact us to view it again.' : (
              <>Sharp detail didn’t load. <button className="underline pointer-events-auto" onPointerDown={e => e.stopPropagation()}
                onClick={() => { fails.current = 0; links.current = null; setShown({}); setNotice(''); setRetry(n => n + 1) }}>Try again</button></>
            )}
          </p>
        </div>
      )}
    </>
  )
}
