'use client'
import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

// Served same-origin from /public (copied by scripts/copy-pdf-worker.mjs) — a
// cross-origin module worker can't be instantiated by the browser.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

const MAX_WIDTH = 750 // desktop: same size as before

export function InvoicePDFPreview({ invoiceId }: { invoiceId: string }) {
  const [numPages, setNumPages] = useState(0)
  // Fit the page to the space actually available (a phone is ~360–400px wide),
  // instead of a fixed 750px page the user has to pan around.
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    // clientWidth includes the wrapper's side padding; keep that as breathing room.
    const measure = () => {
      const cs = getComputedStyle(el)
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      setWidth(Math.min(MAX_WIDTH, Math.floor(inner)))
    }
    measure()
    const ro = new ResizeObserver(measure) // handles rotation + window resizes
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={boxRef} className="w-full px-2 sm:px-4 flex flex-col items-center gap-4">
      {width !== null && (
        <Document
          file={`/api/invoice/${invoiceId}/pdf?preview=true`}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<span className="text-sm text-[#8a8c94]">Loading preview…</span>}
          error={<span className="text-sm text-red-500">Failed to load PDF.</span>}
          className="flex flex-col items-center gap-4"
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page key={i + 1} pageNumber={i + 1} width={width} className="shadow-md"
              renderTextLayer={false} renderAnnotationLayer={false} />
          ))}
        </Document>
      )}
    </div>
  )
}
