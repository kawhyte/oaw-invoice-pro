'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createCombinedInvoiceAction } from '@/app/(dashboard)/invoices/actions'
import { lineSubtotal, computeTotals } from '@/lib/invoiceCalc'
import { StatusChip } from '@/components/ui/StatusChip'
import type { BusinessSettings, DiscountType } from '@/types'

interface LineItem { tempId: string; description: string; quantity: string; unit_price: string }
interface ProjectData {
  id: string
  title: string
  draftInvoice: { id: string; invoice_number: string; amount_paid: number; items: { description: string; quantity: number; unit_price: number }[] } | null
  billed: { invoice_number: string; status: string }[]
}
interface Props {
  client: { id: string; name: string; currency: 'JMD' | 'USD' | null }
  projects: ProjectData[]
  bizSettings: BusinessSettings | null
}

const INPUT = 'w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]'
const newItem = (d = '', q = '1', u = ''): LineItem => ({ tempId: crypto.randomUUID(), description: d, quantity: q, unit_price: u })

function initialItems(p: ProjectData): LineItem[] {
  if (p.draftInvoice && p.draftInvoice.items.length > 0) {
    return p.draftInvoice.items.map(i => newItem(i.description, String(i.quantity), String(i.unit_price)))
  }
  return [newItem()]
}

export function CombinedInvoiceForm({ client, projects, bizSettings }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [currency, setCurrency] = useState<'JMD' | 'USD'>(client.currency ?? 'JMD')
  const [useGct, setUseGct] = useState((client.currency ?? 'JMD') === 'JMD')
  // Default to including every project that has work to bill.
  const [selected, setSelected] = useState<Record<string, boolean>>(
    () => Object.fromEntries(projects.map(p => [p.id, true]))
  )
  const [itemsByProject, setItemsByProject] = useState<Record<string, LineItem[]>>(
    () => Object.fromEntries(projects.map(p => [p.id, initialItems(p)]))
  )
  const [dueDate, setDueDate] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState('')
  const [additionsDesc, setAdditionsDesc] = useState('')
  const [additionsAmount, setAdditionsAmount] = useState('')
  const [amountPaid, setAmountPaid] = useState(
    () => String(projects.reduce((s, p) => s + (p.draftInvoice?.amount_paid ?? 0), 0) || '')
  )
  const [notes, setNotes] = useState('')

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)

  function toggleProject(id: string) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }
  function updateItem(pid: string, tempId: string, field: keyof Omit<LineItem, 'tempId'>, value: string) {
    setItemsByProject(prev => ({
      ...prev,
      [pid]: prev[pid].map(i => (i.tempId === tempId ? { ...i, [field]: value } : i)),
    }))
  }
  function addItem(pid: string) {
    setItemsByProject(prev => ({ ...prev, [pid]: [...prev[pid], newItem()] }))
  }
  function removeItem(pid: string, tempId: string) {
    setItemsByProject(prev => ({ ...prev, [pid]: prev[pid].filter(i => i.tempId !== tempId) }))
  }

  const projectSubtotal = (pid: string) =>
    lineSubtotal(itemsByProject[pid].map(i => ({ quantity: parseFloat(i.quantity) || 0, unit_price: parseFloat(i.unit_price) || 0 })))

  const selectedProjects = projects.filter(p => selected[p.id])
  const subtotal = selectedProjects.reduce((s, p) => s + projectSubtotal(p.id), 0)
  const additionsNum = parseFloat(additionsAmount) || 0
  const { discountAmount, gctAmount, total } = computeTotals({
    subtotal,
    discountType,
    discountValue: parseFloat(discountValue) || 0,
    gctRate: useGct ? 0.15 : 0,
    additionsAmount: additionsNum,
  })
  const amountPaidNum = parseFloat(amountPaid) || 0
  const owing = total - amountPaidNum

  // Projects that will actually be billed (selected + at least one valid item).
  const billableProjects = selectedProjects.filter(p =>
    itemsByProject[p.id].some(i => i.description.trim() && (parseFloat(i.unit_price) || 0) > 0)
  )
  const draftsToReplace = billableProjects.filter(p => p.draftInvoice).map(p => p.draftInvoice!)
  const canSubmit = billableProjects.length >= 2

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (billableProjects.length < 2) {
      setError('Select at least two projects, each with a line item.')
      return
    }

    const sections = billableProjects.map(p => ({
      project_id: p.id,
      section_title: p.title,
      line_items: itemsByProject[p.id]
        .filter(i => i.description.trim() && (parseFloat(i.unit_price) || 0) > 0)
        .map(i => ({
          description: i.description.trim(),
          quantity: parseFloat(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
        })),
    }))
    const absorbIds = draftsToReplace.map(d => d.id)

    const fd = new FormData()
    fd.set('client_id', client.id)
    fd.set('currency', currency)
    fd.set('use_gct', String(useGct))
    fd.set('due_date', dueDate)
    fd.set('discount_type', discountType)
    fd.set('discount_value', discountValue)
    fd.set('additions_description', additionsDesc)
    fd.set('additions_amount', additionsAmount)
    fd.set('amount_paid', amountPaid)
    fd.set('notes', notes)
    fd.set('sections', JSON.stringify(sections))
    fd.set('absorb_invoice_ids', JSON.stringify(absorbIds))

    startTransition(async () => {
      try {
        const id = await createCombinedInvoiceAction(fd)
        router.push(`/invoices/${id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Business banner */}
      {bizSettings?.business_name ? (
        <div className="bg-[#f5ede4] border border-[#715a3e]/20 rounded-xl px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#1a1c1e]">{bizSettings.business_name}</p>
            <p className="text-xs text-[#715a3e]">{[bizSettings.phone, bizSettings.email].filter(Boolean).join(' · ')}</p>
          </div>
          <a href="/settings" className="text-xs text-[#715a3e] hover:text-[#8b7355] underline">Edit</a>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <p className="text-sm text-amber-800">Business info not set. <a href="/settings" className="underline font-medium">Add it in Settings</a> — it appears on your PDF invoices.</p>
        </div>
      )}

      {/* Invoice-level details */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 space-y-4">
        <h2 className="label-caps">Invoice Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#5a5c62] mb-1">Currency</label>
            <select value={currency} onChange={e => { setCurrency(e.target.value as 'JMD' | 'USD'); setUseGct(e.target.value === 'JMD') }} className={`${INPUT} select-field`}>
              <option value="JMD">JMD</option>
              <option value="USD">USD</option>
            </select>
            <p className="text-xs text-[#8a8c94] mt-1">All projects are billed in one currency.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5a5c62] mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT} />
          </div>
        </div>
        {currency === 'JMD' && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button type="button" onClick={() => setUseGct(v => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${useGct ? 'bg-[#715a3e]' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useGct ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-sm text-[#5a5c62]">Apply GCT (15%) to the combined total</span>
          </label>
        )}
      </div>

      {/* Project sections */}
      <div className="space-y-4">
        <h2 className="label-caps px-1">Projects &amp; Line Items</h2>
        {projects.map(p => {
          const isSel = selected[p.id]
          return (
            <div key={p.id} className={`bg-white rounded-xl border shadow-card overflow-hidden transition-colors ${isSel ? 'border-[#715a3e]/40' : 'border-[#e0e0e3]'}`}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={isSel} onChange={() => toggleProject(p.id)}
                    className="w-4 h-4 accent-[#715a3e]" />
                  <span className="text-sm font-medium text-[#1a1c1e]">{p.title}</span>
                  {p.draftInvoice && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                      Draft {p.draftInvoice.invoice_number} — will be replaced
                    </span>
                  )}
                </label>
                {isSel && <span className="font-mono text-sm text-[#5a5c62]">{fmt(projectSubtotal(p.id))}</span>}
              </div>

              {p.billed.length > 0 && (
                <div className="px-6 py-2 bg-[#f8f9fa] border-b border-gray-100 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#8a8c94]">Already billed (not included):</span>
                  {p.billed.map(b => (
                    <span key={b.invoice_number} className="inline-flex items-center gap-1">
                      <span className="font-mono text-xs text-[#5a5c62]">{b.invoice_number}</span>
                      <StatusChip status={b.status} />
                    </span>
                  ))}
                </div>
              )}

              {isSel && (
                <div className="p-6 space-y-3">
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-[#8a8c94] px-1">
                    <span className="col-span-5">Description</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-3">Unit Price</span>
                    <span className="col-span-1 text-right">Amount</span>
                    <span className="col-span-1" />
                  </div>
                  {itemsByProject[p.id].map(item => {
                    const amt = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
                    return (
                      <div key={item.tempId} className="grid grid-cols-12 gap-2 items-center">
                        <input value={item.description} onChange={e => updateItem(p.id, item.tempId, 'description', e.target.value)}
                          placeholder="Description of work"
                          className="col-span-5 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
                        <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(p.id, item.tempId, 'quantity', e.target.value)}
                          className="col-span-2 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white text-center data-mono focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
                        <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(p.id, item.tempId, 'unit_price', e.target.value)}
                          placeholder="0.00"
                          className="col-span-3 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white data-mono focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
                        <span className="col-span-1 text-sm text-[#5a5c62] text-right font-medium data-mono">{fmt(amt)}</span>
                        <button type="button" onClick={() => removeItem(p.id, item.tempId)}
                          disabled={itemsByProject[p.id].length <= 1} className="col-span-1 text-gray-400 hover:text-red-500 disabled:opacity-20 text-lg leading-none text-center">×</button>
                      </div>
                    )
                  })}
                  <button type="button" onClick={() => addItem(p.id)} className="text-sm text-[#715a3e] hover:text-[#8b7355] font-medium">+ Add Line Item</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Discount + Additions */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="label-caps">Discount</h2>
          <select value={discountType} onChange={e => { setDiscountType(e.target.value as DiscountType); setDiscountValue('') }} className={`${INPUT} select-field`}>
            <option value="none">No Discount</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount ({currency})</option>
          </select>
          {discountType !== 'none' && (
            <input type="number" min="0" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percentage' ? 'e.g. 10' : '0.00'} className={INPUT} />
          )}
        </div>
        <div className="space-y-3">
          <h2 className="label-caps">Additions</h2>
          <input value={additionsDesc} onChange={e => setAdditionsDesc(e.target.value)} placeholder="e.g. Rush fee, Materials" className={INPUT} />
          <input type="number" min="0" step="0.01" value={additionsAmount} onChange={e => setAdditionsAmount(e.target.value)} placeholder={`Amount (${currency})`} className={INPUT} />
        </div>
      </div>

      {/* Notes + Amount Paid */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-[#5a5c62] mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Payment terms, bank details..." className={`${INPUT} resize-none`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5a5c62] mb-1">Amount Already Paid ({currency})</label>
          <input type="number" min="0" step="0.01" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" className={INPUT} />
          <p className="text-xs text-[#8a8c94] mt-1">Leave 0 if nothing has been paid yet</p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 space-y-2 text-sm">
        {billableProjects.map(p => (
          <div key={p.id} className="flex justify-between text-[#5a5c62]"><span>{p.title}</span><span className="data-mono">{fmt(projectSubtotal(p.id))}</span></div>
        ))}
        <div className="flex justify-between text-[#5a5c62] pt-2 border-t border-[#f0f0f2]"><span>Subtotal</span><span className="data-mono">{fmt(subtotal)}</span></div>
        {discountAmount > 0 && <div className="flex justify-between text-[#5a5c62]"><span>Discount</span><span className="data-mono">- {fmt(discountAmount)}</span></div>}
        {useGct && <div className="flex justify-between text-[#5a5c62]"><span>GCT (15%)</span><span className="data-mono">{fmt(gctAmount)}</span></div>}
        {additionsNum > 0 && <div className="flex justify-between text-[#5a5c62]"><span>{additionsDesc || 'Additions'}</span><span className="data-mono">+ {fmt(additionsNum)}</span></div>}
        <div className="flex justify-between font-bold text-[#1a1c1e] text-base pt-2 border-t border-[#e0e0e3]"><span>Total</span><span className="data-mono">{fmt(total)}</span></div>
        {amountPaidNum > 0 && <div className="flex justify-between text-[#2a5130]"><span>Paid</span><span className="data-mono">{fmt(amountPaidNum)}</span></div>}
        {amountPaidNum > 0 && <div className="flex justify-between font-semibold text-amber-600"><span>Owing</span><span className="data-mono">{fmt(owing)}</span></div>}
      </div>

      {draftsToReplace.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800">
          Creating this invoice will <span className="font-medium">replace {draftsToReplace.length} draft {draftsToReplace.length === 1 ? 'invoice' : 'invoices'}</span> ({draftsToReplace.map(d => d.invoice_number).join(', ')}) so the work isn&apos;t billed twice.
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <Link href={`/clients/${client.id}`} className="px-4 py-2 text-sm text-[#5a5c62] hover:text-[#1a1c1e]">Cancel</Link>
        <button type="submit" disabled={isPending || !canSubmit}
          className="px-6 py-2 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50 font-medium">
          {isPending ? 'Creating...' : 'Create Combined Invoice'}
        </button>
      </div>
    </form>
  )
}
