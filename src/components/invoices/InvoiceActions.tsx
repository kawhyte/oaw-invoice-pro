'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { deleteInvoiceAction, markSentAction } from '@/app/(dashboard)/invoices/actions'

const InvoicePDFPreview = dynamic(
  () => import('./InvoicePDFPreview').then(m => m.InvoicePDFPreview),
  { ssr: false }
)

export function InvoiceActions({ invoiceId, clientEmail, status }: { invoiceId: string; clientEmail: string | null; status: string }) {
  const router = useRouter()
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()
  const [previewOpen, setPreviewOpen] = useState(false)

  async function handleEmail() {
    setEmailStatus('sending')
    const res = await fetch(`/api/invoice/${invoiceId}/email`, { method: 'POST' })
    if (res.ok) {
      setEmailStatus('sent')
      startTransition(async () => { await markSentAction(invoiceId) })
    } else {
      setEmailStatus('error')
    }
    setTimeout(() => setEmailStatus('idle'), 3000)
  }

  function handleDelete() {
    if (!confirm('Delete this invoice?')) return
    startTransition(async () => {
      await deleteInvoiceAction(invoiceId)
      router.push('/invoices')
    })
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {status === 'draft' && (
          <button onClick={() => startTransition(async () => { await markSentAction(invoiceId) })} disabled={isPending}
            className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg text-[#1a1c1e] hover:bg-[#f8f9fa] disabled:opacity-50">
            Mark as Sent
          </button>
        )}
        <button
          onClick={() => setPreviewOpen(true)}
          className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg text-[#1a1c1e] hover:bg-[#f8f9fa] transition-colors"
        >
          Preview
        </button>
        <a href={`/api/invoice/${invoiceId}/pdf`} target="_blank" rel="noopener noreferrer"
          className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg text-[#1a1c1e] hover:bg-[#f8f9fa] transition-colors">
          Download PDF
        </a>
        {clientEmail && (
          <button onClick={handleEmail} disabled={emailStatus === 'sending'}
            className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50 transition-colors">
            {emailStatus === 'idle' ? 'Email to Client' : emailStatus === 'sending' ? 'Sending...' : emailStatus === 'sent' ? '✓ Sent' : 'Error — Retry'}
          </button>
        )}
        <button onClick={handleDelete} disabled={isPending} className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
          Delete
        </button>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col" onClick={() => setPreviewOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative z-10 flex flex-col mx-auto my-6 w-full max-w-4xl h-[calc(100vh-3rem)] bg-white rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#e0e0e3] bg-white">
              <span className="text-sm font-medium text-[#1a1c1e]">Invoice Preview</span>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-[#8a8c94] hover:text-[#1a1c1e] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f0f0f0] flex flex-col items-center py-4 gap-4">
              <InvoicePDFPreview invoiceId={invoiceId} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
