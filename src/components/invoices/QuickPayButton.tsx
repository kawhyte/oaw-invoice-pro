'use client'
import { useTransition } from 'react'
import { updateAmountPaidAction } from '@/app/(dashboard)/invoices/actions'
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
 * One-tap "client paid this in full" from list rows. Reuses the existing
 * updateAmountPaidAction (auth + ownership + status recompute + revalidate
 * live there). Rendered inside clickable rows/Links, so it must stop the
 * row's navigation (preventDefault + stopPropagation).
 */
export function QuickPayButton({ invoiceId, invoiceNumber, total, amountPaid, currency }: Props) {
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()
  const toast = useToast()

  const owing = Number(total) - Number(amountPaid)
  if (!(Number(total) > 0) || owing <= 0) return null

  const fmtTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(total))

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const ok = await confirm({
          title: `Mark ${invoiceNumber} as paid?`,
          description: `Records the full ${fmtTotal} as received.`,
          confirmLabel: 'Mark paid',
          variant: 'default',
        })
        if (!ok) return
        startTransition(async () => {
          try {
            await updateAmountPaidAction(invoiceId, Number(total))
            toast.success(`${invoiceNumber} marked paid.`)
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
