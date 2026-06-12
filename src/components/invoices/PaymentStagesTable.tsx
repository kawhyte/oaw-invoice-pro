'use client'
import { useTransition } from 'react'
import { markPaymentPaidAction, markPaymentUnpaidAction } from '@/app/(dashboard)/invoices/actions'
import type { InvoicePayment } from '@/types'

interface Props { invoiceId: string; payments: InvoicePayment[]; currency: string }

export function PaymentStagesTable({ invoiceId, payments, currency }: Props) {
  const [isPending, startTransition] = useTransition()
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)

  function toggle(p: InvoicePayment) {
    startTransition(async () => {
      if (p.status === 'pending') await markPaymentPaidAction(p.id, invoiceId)
      else await markPaymentUnpaidAction(p.id, invoiceId)
    })
  }

  return (
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
          <th className="px-6 py-3" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {payments.map(p => (
          <tr key={p.id}>
            <td className="px-6 py-4 text-sm text-gray-900">{p.label}</td>
            <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">{fmt(p.amount)}</td>
            <td className="px-6 py-4 text-sm text-gray-500">
              {p.due_date ? new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            </td>
            <td className="px-6 py-4">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {p.status === 'paid'
                  ? `Paid${p.paid_date ? ' · ' + new Date(p.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`
                  : 'Pending'}
              </span>
            </td>
            <td className="px-6 py-4 text-right">
              <button onClick={() => toggle(p)} disabled={isPending}
                className={`text-xs font-medium disabled:opacity-50 ${p.status === 'paid' ? 'text-gray-400 hover:text-gray-600' : 'text-emerald-700 hover:text-emerald-800'}`}>
                {p.status === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
