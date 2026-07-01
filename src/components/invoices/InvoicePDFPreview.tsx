'use client'
import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

// Served same-origin from /public (copied by scripts/copy-pdf-worker.mjs) — a
// cross-origin module worker can't be instantiated by the browser.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export function InvoicePDFPreview({ invoiceId }: { invoiceId: string }) {
  const [numPages, setNumPages] = useState(0)
  return (
    <Document
      file={`/api/invoice/${invoiceId}/pdf?preview=true`}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
      loading={<span className="text-sm text-[#8a8c94]">Loading preview…</span>}
      error={<span className="text-sm text-red-500">Failed to load PDF.</span>}
    >
      {Array.from({ length: numPages }, (_, i) => (
        <Page key={i + 1} pageNumber={i + 1} width={750} className="shadow-md"
          renderTextLayer={false} renderAnnotationLayer={false} />
      ))}
    </Document>
  )
}
