'use client'
import { useTransition } from 'react'
import { markInvoicePaidAction } from '@/app/(dashboard)/invoices/actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast, toErrorMessage } from '@/components/ui/Toast'

interface Props {
  invoiceId: string
  invoiceNumber: string
  total: number
  amountPaid: number
  currency: string
}

/**
 * One-tap "client paid the rest" from list rows: records the remaining
 * balance as a payment dated today (with its own receipt, shareable from the
 * invoice page). Rendered inside clickable rows/Links, so it must stop the
 * row's navigation (preventDefault + stopPropagation).
 */
export function QuickPayButton({ invoiceId, invoiceNumber, total, amountPaid, currency }: Props) {
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()
  const toast = useToast()

  const owing = Number(total) - Number(amountPaid)
  if (!(Number(total) > 0) || owing <= 0) return null

  const fmtOwing = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(owing)

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const ok = await confirm({
          title: `Mark ${invoiceNumber} as paid?`,
          description: `Records the remaining ${fmtOwing} as received today, with a receipt you can share from the invoice.`,
          confirmLabel: 'Mark paid',
          variant: 'default',
        })
        if (!ok) return
        startTransition(async () => {
          try {
            const r = await markInvoicePaidAction(invoiceId)
            toast.success(r ? `${invoiceNumber} marked paid — receipt ${r.receipt_number}.` : `${invoiceNumber} is already paid.`)
          } catch (err) {
            toast.error(toErrorMessage(err))
          }
        })
      }}
      className="px-2.5 py-1 text-xs font-medium text-[#715a3e] border border-[#715a3e]/30 rounded-lg hover:bg-[#f5ede4] disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {isPending ? 'Saving…' : 'Mark paid'}
    </button>
  )
}
