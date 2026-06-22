'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createInvoiceAction, updateInvoiceAction } from '@/app/(dashboard)/invoices/actions'
import { lineSubtotal, computeTotals } from '@/lib/invoiceCalc'
import type { Client, Project, BusinessSettings, DiscountType, Invoice, InvoiceLineItem } from '@/types'

interface ProjectWithClient extends Omit<Project, 'clients'> { clients: Client | null }
interface LineItem { tempId: string; description: string; quantity: string; unit_price: string }

const newItem = (): LineItem => ({ tempId: crypto.randomUUID(), description: '', quantity: '1', unit_price: '' })

const INPUT = 'w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]'

interface InvoiceFormProps {
  projects: ProjectWithClient[]
  bizSettings: BusinessSettings | null
  invoice?: Invoice & { invoice_line_items?: InvoiceLineItem[] }
  editMode?: boolean
}

export function InvoiceForm({ projects, bizSettings, invoice, editMode }: InvoiceFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedProjectId, setSelectedProjectId] = useState(() =>
    editMode && invoice ? invoice.project_id ?? '' : ''
  )
  const [currency, setCurrency] = useState<'JMD' | 'USD'>(() =>
    editMode && invoice ? invoice.currency : 'JMD'
  )
  const [useGct, setUseGct] = useState(() =>
    editMode && invoice ? invoice.gct_rate > 0 : false
  )
  const [dueDate, setDueDate] = useState(() =>
    editMode && invoice?.due_date ? invoice.due_date : ''
  )
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (editMode && invoice?.invoice_line_items && invoice.invoice_line_items.length > 0) {
      return [...invoice.invoice_line_items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(item => ({
          tempId: crypto.randomUUID(),
          description: item.description,
          quantity: String(item.quantity),
          unit_price: String(item.unit_price),
        }))
    }
    return [newItem()]
  })
  const [discountType, setDiscountType] = useState<DiscountType>(() =>
    editMode && invoice?.discount_type ? invoice.discount_type : 'none'
  )
  const [discountValue, setDiscountValue] = useState(() =>
    editMode && invoice?.discount_value ? String(invoice.discount_value) : ''
  )
  const [additionsDesc, setAdditionsDesc] = useState(() =>
    editMode && invoice?.additions_description ? invoice.additions_description : ''
  )
  const [additionsAmount, setAdditionsAmount] = useState(() =>
    editMode && invoice?.additions_amount ? String(invoice.additions_amount) : ''
  )
  const [amountPaid, setAmountPaid] = useState(() =>
    editMode && invoice?.amount_paid ? String(invoice.amount_paid) : ''
  )
  const [notes, setNotes] = useState(() =>
    editMode && invoice?.notes ? invoice.notes : ''
  )

  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const invoiceProject = editMode ? (invoice as any)?.projects : null

  function handleProjectChange(id: string) {
    setSelectedProjectId(id)
    const p = projects.find(p => p.id === id)
    if (p?.clients?.currency) {
      setCurrency(p.clients.currency as 'JMD' | 'USD')
      setUseGct(p.clients.currency === 'JMD')
    }
  }

  function updateItem(tempId: string, field: keyof Omit<LineItem, 'tempId'>, value: string) {
    setLineItems(prev => prev.map(i => i.tempId === tempId ? { ...i, [field]: value } : i))
  }

  const subtotal = lineSubtotal(lineItems.map(i => ({ quantity: parseFloat(i.quantity) || 0, unit_price: parseFloat(i.unit_price) || 0 })))
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

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editMode && !selectedProjectId) return
    const validItems = lineItems.filter(i => i.description.trim() && parseFloat(i.unit_price) > 0)
    if (!validItems.length) return

    const fd = new FormData()
    fd.set('project_id', selectedProjectId)
    fd.set('currency', currency)
    fd.set('use_gct', String(useGct))
    fd.set('due_date', dueDate)
    fd.set('discount_type', discountType)
    fd.set('discount_value', discountValue)
    fd.set('additions_description', additionsDesc)
    fd.set('additions_amount', additionsAmount)
    fd.set('amount_paid', amountPaid)
    fd.set('notes', notes)
    fd.set('line_items', JSON.stringify(validItems.map(i => ({
      description: i.description.trim(),
      quantity: parseFloat(i.quantity) || 1,
      unit_price: parseFloat(i.unit_price) || 0,
    }))))

    if (editMode && invoice) {
      startTransition(async () => {
        await updateInvoiceAction(invoice.id, fd)
      })
    } else {
      startTransition(async () => {
        const id = await createInvoiceAction(fd)
        router.push(`/invoices/${id}`)
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* Business info banner */}
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

      {/* Project + Invoice details */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 space-y-4">
        <h2 className="label-caps">Invoice Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#5a5c62] mb-1">Project {!editMode && '*'}</label>
            {editMode ? (
              <div className={`${INPUT} bg-[#f8f9fa] text-[#5a5c62] cursor-not-allowed`}>
                {invoiceProject?.title} — {invoiceProject?.clients?.name}
              </div>
            ) : (
              <select value={selectedProjectId} onChange={e => handleProjectChange(e.target.value)} required className={INPUT}>
                <option value="">Select a project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title} — {p.clients?.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5a5c62] mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT} />
          </div>
        </div>

        {!editMode && selectedProject && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm bg-[#f8f9fa] rounded-lg p-3">
            <div><span className="text-[#8a8c94]">Client:</span> <span className="font-medium text-[#1a1c1e]">{selectedProject.clients?.name}</span></div>
            {selectedProject.job_type && <div><span className="text-[#8a8c94]">Job Type:</span> <span className="font-medium text-[#1a1c1e]">{selectedProject.job_type}</span></div>}
            {selectedProject.location_address && <div><span className="text-[#8a8c94]">Location:</span> <span className="font-medium text-[#1a1c1e]">{selectedProject.location_address}</span></div>}
          </div>
        )}

        {editMode && invoiceProject && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm bg-[#f8f9fa] rounded-lg p-3">
            <div><span className="text-[#8a8c94]">Client:</span> <span className="font-medium text-[#1a1c1e]">{invoiceProject.clients?.name}</span></div>
            {invoiceProject.job_type && <div><span className="text-[#8a8c94]">Job Type:</span> <span className="font-medium text-[#1a1c1e]">{invoiceProject.job_type}</span></div>}
            {invoiceProject.location_address && <div><span className="text-[#8a8c94]">Location:</span> <span className="font-medium text-[#1a1c1e]">{invoiceProject.location_address}</span></div>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#5a5c62] mb-1">Currency</label>
            <select value={currency} onChange={e => { setCurrency(e.target.value as 'JMD' | 'USD'); setUseGct(e.target.value === 'JMD') }} className={INPUT}>
              <option value="JMD">JMD</option>
              <option value="USD">USD</option>
            </select>
          </div>
          {currency === 'JMD' && (
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button type="button" onClick={() => setUseGct(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${useGct ? 'bg-[#715a3e]' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useGct ? 'translate-x-4' : ''}`} />
                </button>
                <span className="text-sm text-[#5a5c62]">Apply GCT (15%)</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 space-y-3">
        <h2 className="label-caps">Line Items</h2>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-[#8a8c94] px-1">
            <span className="col-span-5">Description</span>
            <span className="col-span-2 text-center">Qty</span>
            <span className="col-span-3">Unit Price</span>
            <span className="col-span-1 text-right">Amount</span>
            <span className="col-span-1" />
          </div>
          {lineItems.map(item => {
            const amt = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
            return (
              <div key={item.tempId} className="grid grid-cols-12 gap-2 items-center">
                <input value={item.description} onChange={e => updateItem(item.tempId, 'description', e.target.value)}
                  placeholder="Description of work"
                  className={`col-span-5 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]`} />
                <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(item.tempId, 'quantity', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white text-center data-mono focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
                <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(item.tempId, 'unit_price', e.target.value)}
                  placeholder="0.00"
                  className="col-span-3 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white data-mono focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
                <span className="col-span-1 text-sm text-[#5a5c62] text-right font-medium data-mono">{fmt(amt)}</span>
                <button type="button" onClick={() => setLineItems(p => p.filter(i => i.tempId !== item.tempId))}
                  disabled={lineItems.length <= 1} className="col-span-1 text-gray-400 hover:text-red-500 disabled:opacity-20 text-lg leading-none text-center">×</button>
              </div>
            )
          })}
        </div>
        <button type="button" onClick={() => setLineItems(p => [...p, newItem()])}
          className="text-sm text-[#715a3e] hover:text-[#8b7355] font-medium">+ Add Line Item</button>
      </div>

      {/* Discount + Additions */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="label-caps">Discount</h2>
          <select value={discountType} onChange={e => { setDiscountType(e.target.value as DiscountType); setDiscountValue('') }} className={INPUT}>
            <option value="none">No Discount</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount ({currency})</option>
          </select>
          {discountType !== 'none' && (
            <input type="number" min="0" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percentage' ? 'e.g. 10' : '0.00'}
              className={INPUT} />
          )}
        </div>
        <div className="space-y-3">
          <h2 className="label-caps">Additions</h2>
          <input value={additionsDesc} onChange={e => setAdditionsDesc(e.target.value)}
            placeholder="e.g. Rush fee, Materials" className={INPUT} />
          <input type="number" min="0" step="0.01" value={additionsAmount} onChange={e => setAdditionsAmount(e.target.value)}
            placeholder={`Amount (${currency})`} className={INPUT} />
        </div>
      </div>

      {/* Notes + Amount Paid */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-[#5a5c62] mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Payment terms, bank details..."
            className={`${INPUT} resize-none`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5a5c62] mb-1">Amount Already Paid ({currency})</label>
          <input type="number" min="0" step="0.01" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
            placeholder="0.00" className={INPUT} />
          <p className="text-xs text-[#8a8c94] mt-1">Leave 0 if nothing has been paid yet</p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6 space-y-2 text-sm">
        <div className="flex justify-between text-[#5a5c62]"><span>Subtotal</span><span className="data-mono">{fmt(subtotal)}</span></div>
        {discountAmount > 0 && <div className="flex justify-between text-[#5a5c62]"><span>Discount</span><span className="data-mono">- {fmt(discountAmount)}</span></div>}
        {useGct && <div className="flex justify-between text-[#5a5c62]"><span>GCT (15%)</span><span className="data-mono">{fmt(gctAmount)}</span></div>}
        {additionsNum > 0 && <div className="flex justify-between text-[#5a5c62]"><span>{additionsDesc || 'Additions'}</span><span className="data-mono">+ {fmt(additionsNum)}</span></div>}
        <div className="flex justify-between font-bold text-[#1a1c1e] text-base pt-2 border-t border-[#e0e0e3]"><span>Total</span><span className="data-mono">{fmt(total)}</span></div>
        {amountPaidNum > 0 && <div className="flex justify-between text-[#2a5130]"><span>Paid</span><span className="data-mono">{fmt(amountPaidNum)}</span></div>}
        {amountPaidNum > 0 && <div className="flex justify-between font-semibold text-amber-600"><span>Owing</span><span className="data-mono">{fmt(owing)}</span></div>}
      </div>

      <div className="flex items-center gap-3">
        {editMode && invoice ? (
          <Link href={`/invoices/${invoice.id}`} className="px-4 py-2 text-sm text-[#5a5c62] hover:text-[#1a1c1e]">
            ← Back to Invoice
          </Link>
        ) : (
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-[#5a5c62] hover:text-[#1a1c1e]">Cancel</button>
        )}
        <button type="submit" disabled={isPending || (!editMode && !selectedProjectId)}
          className="px-6 py-2 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50 font-medium">
          {isPending ? (editMode ? 'Saving...' : 'Creating...') : (editMode ? 'Save Changes' : 'Create Invoice')}
        </button>
      </div>
    </form>
  )
}
