'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteInvoiceAction, markSentAction } from '@/app/(dashboard)/invoices/actions'

export function InvoiceActions({ invoiceId, clientEmail, status }: { invoiceId: string; clientEmail: string | null; status: string }) {
  const router = useRouter()
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()

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
    <div className="flex items-center gap-2 flex-wrap">
      {status === 'draft' && (
        <button onClick={() => startTransition(async () => { await markSentAction(invoiceId) })} disabled={isPending}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          Mark as Sent
        </button>
      )}
      <a href={`/api/invoice/${invoiceId}/pdf`} target="_blank" rel="noopener noreferrer"
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        Download PDF
      </a>
      {clientEmail && (
        <button onClick={handleEmail} disabled={emailStatus === 'sending'}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {emailStatus === 'idle' ? 'Email to Client' : emailStatus === 'sending' ? 'Sending...' : emailStatus === 'sent' ? '✓ Sent' : 'Error — Retry'}
        </button>
      )}
      <button onClick={handleDelete} disabled={isPending} className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
        Delete
      </button>
    </div>
  )
}
