'use client'
import { useState, useTransition } from 'react'
import { FileText, Share2, Trash2, Plus } from 'lucide-react'
import { recordPaymentAction, deletePaymentAction } from '@/app/(dashboard)/invoices/actions'
import { useToast, toErrorMessage } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { canShareFiles, shareFile } from '@/lib/share'
import { PAYMENT_METHOD_LABELS } from '@/lib/paymentMethods'
import type { Payment, PaymentMethod } from '@/types'

interface Props {
  invoiceId: string
  invoiceNumber: string
  currency: string
  total: number
  amountPaid: number
  clientName: string | null
  payments: Payment[]
  /** Today in the business timezone (YYYY-MM-DD) — default and max payment date. */
  today: string
}

const INPUT = 'w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]'
const METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/**
 * The invoice's payment ledger: every payment received, each with its own
 * receipt to view or share (WhatsApp etc. via the Android share sheet), and
 * a form to record a new one. Replaces the old single "amount paid" box.
 */
export function PaymentsPanel({ invoiceId, invoiceNumber, currency, total, amountPaid, clientName, payments, today }: Props) {
  const toast = useToast()
  const confirm = useConfirm()
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
  const owing = Math.max(0, Math.round((total - amountPaid) * 100) / 100)

  const [formOpen, setFormOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(today)
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [note, setNote] = useState('')
  const [saving, startSaving] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [justRecordedId, setJustRecordedId] = useState<string | null>(null)

  // Share: the PDF is fetched first; if that outlasts the tap's user activation
  // navigator.share rejects, so keep the file and ask for a second tap.
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [readyFile, setReadyFile] = useState<{ id: string; file: File } | null>(null)

  function openForm() {
    setAmount(owing > 0 ? String(owing) : '')
    setPaidOn(today)
    setMethod('')
    setNote('')
    setFormOpen(true)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startSaving(async () => {
      try {
        const r = await recordPaymentAction(invoiceId, { amount: parseFloat(amount), paid_on: paidOn, method: method || null, note: note || null })
        setFormOpen(false)
        setJustRecordedId(r.id)
        toast.success(`Payment recorded — receipt ${r.receipt_number}.`)
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  async function remove(p: Payment) {
    const ok = await confirm({
      title: `Delete this ${fmt(p.amount)} payment?`,
      description: p.receipt_number
        ? `Receipt ${p.receipt_number} will no longer be valid and its number won’t be reused. The invoice balance goes back up by ${fmt(p.amount)}.`
        : `The invoice balance goes back up by ${fmt(p.amount)}.`,
      confirmLabel: 'Delete payment',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(p.id)
    try {
      await deletePaymentAction(p.id, invoiceId)
      toast.success('Payment deleted.')
    } catch (err) {
      toast.error(toErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  async function share(p: Payment) {
    const url = `/api/payment/${p.id}/receipt`
    if (!canShareFiles()) { window.open(`${url}?preview=true`, '_blank'); return }
    setSharingId(p.id)
    try {
      let file = readyFile?.id === p.id ? readyFile.file : null
      if (!file) {
        const res = await fetch(url)
        if (!res.ok) throw new Error('Could not generate the receipt.')
        file = new File([await res.blob()], `${p.receipt_number}.pdf`, { type: 'application/pdf' })
      }
      const text = `Hi${clientName ? ` ${clientName}` : ''}, here is your receipt ${p.receipt_number} for ${fmt(p.amount)} received on ${fmtDay(p.paid_on)} (invoice ${invoiceNumber}). Thank you!`
      const result = await shareFile(file, `Receipt ${p.receipt_number}`, text)
      if (result === 'needs-gesture') { setReadyFile({ id: p.id, file }); toast.success('Receipt ready — tap Share now.'); return }
      setReadyFile(null)
    } catch (err) {
      toast.error(toErrorMessage(err))
    } finally {
      setSharingId(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="label-caps">Payments</h2>
          <p className="text-sm text-[#5a5c62] mt-1">
            <span className="data-mono text-[#2a5130]">{fmt(amountPaid)}</span> paid of <span className="data-mono">{fmt(total)}</span>
            {owing > 0 && <> · <span className="data-mono font-semibold text-amber-600">{fmt(owing)}</span> owing</>}
          </p>
        </div>
        {owing > 0 && !formOpen && (
          <button type="button" onClick={openForm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors">
            <Plus size={14} /> Record payment
          </button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={submit} className="px-6 py-5 border-b border-gray-100 bg-[#f8f9fa] grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#5a5c62] mb-1">Amount received ({currency})</label>
            <input type="number" inputMode="decimal" min="0.01" step="0.01" max={owing} required value={amount}
              onChange={e => setAmount(e.target.value)} className={`${INPUT} data-mono`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5a5c62] mb-1">Date received</label>
            <input type="date" required max={today} value={paidOn} onChange={e => setPaidOn(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5a5c62] mb-1">Method</label>
            <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod | '')} className={`${INPUT} select-field`}>
              <option value="">Not specified</option>
              {METHODS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5a5c62] mb-1">Note <span className="text-[#8a8c94] font-normal">(optional, shows on receipt)</span></label>
            <input value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="e.g. Deposit, NCB transfer ref 1234" className={INPUT} />
          </div>
          <div className="sm:col-span-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} disabled={saving}
              className="px-4 py-2 text-sm border border-[#e0e0e3] rounded-lg text-[#1a1c1e] hover:bg-white disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50">
              {saving ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </form>
      )}

      {payments.length === 0 ? (
        <p className="px-6 py-6 text-sm text-[#8a8c94]">No payments yet. Record one when the client pays — each payment gets its own receipt.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {payments.map(p => {
            const fresh = p.id === justRecordedId
            return (
              <li key={p.id} className={`px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap ${fresh ? 'bg-[#f5ede4]/60' : ''}`}>
                <div className="flex-1 min-w-[10rem]">
                  <p className="text-sm text-[#1a1c1e]">
                    <span className="data-mono font-medium">{fmt(p.amount)}</span>
                    <span className="text-[#5a5c62]"> · {fmtDay(p.paid_on)}{p.method ? ` · ${PAYMENT_METHOD_LABELS[p.method]}` : ''}</span>
                  </p>
                  <p className="text-xs text-[#8a8c94] mt-0.5 break-words">
                    {p.receipt_number ? <span className="data-mono">{p.receipt_number}</span> : 'Earlier payments (recorded before receipts)'}
                    {p.receipt_number && p.note ? ` · ${p.note}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.receipt_number && (
                    <>
                      <a href={`/api/payment/${p.id}/receipt?preview=true`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-[#e0e0e3] rounded-lg text-[#1a1c1e] hover:bg-[#f8f9fa]">
                        <FileText size={13} /> Receipt
                      </a>
                      <button type="button" onClick={() => share(p)} disabled={sharingId === p.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg disabled:opacity-50 ${fresh || readyFile?.id === p.id ? 'bg-[#715a3e] text-white hover:bg-[#8b7355]' : 'border border-[#715a3e]/30 text-[#715a3e] hover:bg-[#f5ede4]'}`}>
                        <Share2 size={13} /> {sharingId === p.id ? 'Preparing…' : readyFile?.id === p.id ? 'Share now' : 'Share'}
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => remove(p)} disabled={deletingId === p.id} aria-label="Delete payment"
                    className="p-1.5 text-[#8a8c94] hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
