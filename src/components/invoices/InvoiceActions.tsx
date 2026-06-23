'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Check } from 'lucide-react'
import dynamic from 'next/dynamic'
import { deleteInvoiceAction, markSentAction, uploadInvoicePdfAction } from '@/app/(dashboard)/invoices/actions'

const InvoicePDFPreview = dynamic(
  () => import('./InvoicePDFPreview').then(m => m.InvoicePDFPreview),
  { ssr: false }
)

interface Props {
  invoiceId: string
  invoiceNumber: string
  clientEmail: string | null
  status: string
  saveTargets: { id: string; title: string }[]
  savedFile: { id: string; projectId: string } | null
}

export function InvoiceActions({ invoiceId, invoiceNumber, clientEmail, status, saveTargets, savedFile }: Props) {
  const router = useRouter()
  // Email feature — paused for future sprint (see button comment below)
  // const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // ---- "Save for client" state ----
  const canSave = saveTargets.length > 0
  const [isSaving, startSaving] = useTransition()
  const [saveState, setSaveState] = useState<'idle' | 'success' | 'error'>('idle')
  const [selectedProjectId, setSelectedProjectId] = useState(
    savedFile?.projectId ?? saveTargets[0]?.id ?? ''
  )
  const alreadySaved = savedFile !== null
  const savedTarget = saveTargets.find(t => t.id === selectedProjectId)

  function openPreview() {
    setSaveState('idle')
    setPreviewOpen(true)
  }

  function handleSave() {
    if (!selectedProjectId) return
    setSaveState('idle')
    startSaving(async () => {
      try {
        await uploadInvoicePdfAction(invoiceId, selectedProjectId)
        setSaveState('success')
        router.refresh()
      } catch {
        setSaveState('error')
      }
    })
  }

  // Email feature — paused for future sprint (see button comment below)
  // async function handleEmail() {
  //   setEmailStatus('sending')
  //   const res = await fetch(`/api/invoice/${invoiceId}/email`, { method: 'POST' })
  //   if (res.ok) {
  //     setEmailStatus('sent')
  //     startTransition(async () => { await markSentAction(invoiceId) })
  //   } else {
  //     setEmailStatus('error')
  //   }
  //   setTimeout(() => setEmailStatus('idle'), 3000)
  // }

  function handleDelete() {
    setShowDeleteModal(false)
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
          onClick={openPreview}
          className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg text-[#1a1c1e] hover:bg-[#f8f9fa] transition-colors"
        >
          Preview
        </button>
        <a href={`/api/invoice/${invoiceId}/pdf`} target="_blank" rel="noopener noreferrer"
          className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg text-[#1a1c1e] hover:bg-[#f8f9fa] transition-colors">
          Download PDF
        </a>
        {canSave && (
          <button
            onClick={openPreview}
            className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors"
          >
            {alreadySaved ? 'Update Client Copy' : 'Save for Client'}
          </button>
        )}
        {/* Email to Client — paused for future sprint.
            Backend route /api/invoice/[id]/email is fully implemented and ready.
            Re-enable by uncommenting this block when the feature goes live.
        {clientEmail && (
          <button onClick={handleEmail} disabled={emailStatus === 'sending'}
            className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50 transition-colors">
            {emailStatus === 'idle' ? 'Email to Client' : emailStatus === 'sending' ? 'Sending...' : emailStatus === 'sent' ? '✓ Sent' : 'Error — Retry'}
          </button>
        )}
        */}
        <button onClick={() => setShowDeleteModal(true)} disabled={isPending} className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
          Delete
        </button>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteModal(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#ffdad6] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#93000a]" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#1a1c1e] text-sm">Delete {invoiceNumber}?</h3>
                <p className="text-xs text-[#5a5c62] mt-1 leading-relaxed">
                  This will permanently delete the invoice and all its line items.
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-medium text-[#1a1c1e] border border-[#e0e0e3] rounded-lg hover:bg-[#f8f9fa] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-[#93000a] hover:bg-[#b91c1c] rounded-lg transition-colors disabled:opacity-50"
              >
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}

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

            {/* Save-for-client footer: review the PDF above, then send it to the project. */}
            {canSave && (
              <div className="border-t border-[#e0e0e3] bg-white px-5 py-3">
                {saveState === 'success' ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2a5130]">
                      <Check size={16} /> Saved to {savedTarget?.title ?? 'project'} — your client can see it.
                    </span>
                    <div className="flex items-center gap-2">
                      {savedTarget && (
                        <Link
                          href={`/projects/${savedTarget.id}`}
                          className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg text-[#1a1c1e] hover:bg-[#f8f9fa] transition-colors text-center"
                        >
                          View in project
                        </Link>
                      )}
                      <button
                        onClick={() => setPreviewOpen(false)}
                        className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex flex-col gap-1 sm:flex-1">
                      {saveTargets.length > 1 ? (
                        <label className="flex flex-col gap-1">
                          <span className="text-xs text-[#5a5c62]">Save this invoice to which project?</span>
                          <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            disabled={isSaving}
                            className="w-full sm:max-w-xs px-3 py-2 text-sm border border-[#e0e0e3] rounded-lg bg-white text-[#1a1c1e] disabled:opacity-50"
                          >
                            {saveTargets.map(t => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <span className="text-xs text-[#5a5c62]">
                          Uploads to <span className="font-medium text-[#1a1c1e]">{savedTarget?.title}</span> and shares it with your client.
                        </span>
                      )}
                      {saveState === 'error' && (
                        <span className="text-xs text-red-500">Couldn’t save — please try again.</span>
                      )}
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !selectedProjectId}
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50 transition-colors shrink-0"
                    >
                      {isSaving
                        ? 'Saving…'
                        : saveState === 'error'
                        ? 'Retry'
                        : alreadySaved
                        ? 'Update saved copy'
                        : 'Looks good — Save for client'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
