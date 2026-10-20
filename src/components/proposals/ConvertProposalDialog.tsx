'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { convertProposalAction } from '@/app/(dashboard)/proposals/actions'
import { todayInBusinessTz } from '@/lib/dates'
import { useToast, toErrorMessage } from '@/components/ui/Toast'

interface Props {
  proposalId: string
  recipientName: string
  isNewClient: boolean
  total: string
  drawingCount: number
  onClose: () => void
}

export function ConvertProposalDialog({ proposalId, recipientName, isNewClient, total, drawingCount, onClose }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [workStarted, setWorkStarted] = useState(todayInBusinessTz())

  function handleConvert() {
    startTransition(async () => {
      try {
        const { invoiceId } = await convertProposalAction(proposalId, workStarted)
        toast.success('Converted — here’s the draft invoice.')
        router.push(`/invoices/${invoiceId}`)
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !isPending && onClose()}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 z-10 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-[#1a1c1e]">Convert to invoice</h3>
          <p className="text-xs text-[#5a5c62] mt-1">This creates, in one step:</p>
          <ul className="text-sm text-[#1a1c1e] mt-2 space-y-1 list-disc pl-5">
            <li>{isNewClient ? <>New client <b>{recipientName}</b></> : <>Uses client <b>{recipientName}</b></>}</li>
            <li>A project, marked In Progress</li>
            <li>A draft invoice for <span className="data-mono">{total}</span></li>
            {drawingCount > 0 && <li>{drawingCount} drawing{drawingCount === 1 ? '' : 's'} moved to the project, unlocking when the invoice is paid</li>}
          </ul>
          <p className="text-xs text-[#8a8c94] mt-2">The proposal becomes read-only.</p>
        </div>
        <label className="block">
          <span className="block text-sm font-medium text-[#5a5c62] mb-1">Date work started</span>
          <input type="date" value={workStarted} onChange={e => setWorkStarted(e.target.value)}
            className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm bg-white focus:outline-none focus:border-[#715a3e]" />
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-[#1a1c1e] border border-[#e0e0e3] rounded-lg hover:bg-[#f8f9fa] disabled:opacity-50">Cancel</button>
          <button onClick={handleConvert} disabled={isPending || !workStarted}
            className="px-4 py-2 text-sm font-medium text-white bg-[#715a3e] hover:bg-[#8b7355] rounded-lg disabled:opacity-50">
            {isPending ? 'Converting…' : 'Convert'}
          </button>
        </div>
      </div>
    </div>
  )
}
