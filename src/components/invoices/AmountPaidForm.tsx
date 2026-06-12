'use client'
import { useState, useTransition } from 'react'
import { updateAmountPaidAction } from '@/app/(dashboard)/invoices/actions'

interface Props { invoiceId: string; currentAmountPaid: number; total: number; currency: string }

export function AmountPaidForm({ invoiceId, currentAmountPaid, total, currency }: Props) {
  const [value, setValue] = useState(currentAmountPaid > 0 ? String(currentAmountPaid) : '')
  const [isPending, startTransition] = useTransition()
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(value) || 0
    startTransition(async () => { await updateAmountPaidAction(invoiceId, amount) })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Track Payment</h2>
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid ({currency})</label>
          <input type="number" min="0" step="0.01" max={total} value={value} onChange={e => setValue(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button type="submit" disabled={isPending}
          className="px-4 py-2 text-sm bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50">
          {isPending ? 'Updating...' : 'Update'}
        </button>
        <p className="text-sm text-gray-500 mb-0.5">of {fmt(total)} total</p>
      </form>
    </div>
  )
}
