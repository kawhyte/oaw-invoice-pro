'use client'
import { useState, useTransition } from 'react'
import { separateInvoiceAction } from '@/app/(dashboard)/invoices/actions'
import { useToast, toErrorMessage } from '@/components/ui/Toast'

export function SeparateInvoiceButton({ invoiceId, projectCount }: { invoiceId: string; projectCount: number }) {
  const [isPending, startTransition] = useTransition()
  const [showModal, setShowModal] = useState(false)
  const toast = useToast()

  function handleSeparate() {
    setShowModal(false)
    startTransition(async () => {
      try {
        await separateInvoiceAction(invoiceId)
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isPending}
        className="px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg text-[#1a1c1e] hover:bg-[#f8f9fa] transition-colors disabled:opacity-50"
      >
        {isPending ? 'Separating...' : 'Separate'}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 z-10" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1a1c1e] text-sm">Separate this combined invoice?</h3>
            <p className="text-xs text-[#5a5c62] mt-2 leading-relaxed">
              This splits the invoice back into {projectCount} individual draft invoices — one per project —
              and deletes the combined one. Any combined-level discount or additions are not carried over
              (they applied to the whole). You can only do this while it&apos;s a draft.
            </p>
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-[#1a1c1e] border border-[#e0e0e3] rounded-lg hover:bg-[#f8f9fa] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSeparate}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-[#715a3e] hover:bg-[#8b7355] rounded-lg transition-colors disabled:opacity-50"
              >
                Separate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
