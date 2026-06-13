'use client'
import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

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
