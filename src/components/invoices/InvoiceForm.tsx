'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoiceAction } from '@/app/(dashboard)/invoices/actions'
import type { Client, Project, BusinessSettings, DiscountType } from '@/types'
import { JOB_TYPES } from '@/types'

interface ProjectWithClient extends Project { clients: Client | null }
interface LineItem { tempId: string; description: string; quantity: string; unit_price: string }

const newItem = (): LineItem => ({ tempId: crypto.randomUUID(), description: '', quantity: '1', unit_price: '' })

export function InvoiceForm({ projects, bizSettings }: { projects: ProjectWithClient[]; bizSettings: BusinessSettings | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [currency, setCurrency] = useState<'JMD' | 'USD'>('JMD')
  const [useGct, setUseGct] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([newItem()])
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState('')
  const [additionsDesc, setAdditionsDesc] = useState('')
  const [additionsAmount, setAdditionsAmount] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [notes, setNotes] = useState('')

  const selectedProject = projects.find(p => p.id === selectedProjectId)

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

  // Calculations
  const subtotal = lineItems.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)
  const discountNum = parseFloat(discountValue) || 0
  const discountAmount = discountType === 'percentage' ? subtotal * (discountNum / 100) : discountType === 'fixed' ? discountNum : 0
  const afterDiscount = subtotal - discountAmount
  const gctAmount = useGct ? afterDiscount * 0.15 : 0
  const additionsNum = parseFloat(additionsAmount) || 0
  const total = afterDiscount + gctAmount + additionsNum
  const amountPaidNum = parseFloat(amountPaid) || 0
  const owing = total - amountPaidNum

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProjectId) return
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

    startTransition(async () => {
      const id = await createInvoiceAction(fd)
      router.push(`/invoices/${id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* Business info banner */}
      {bizSettings?.business_name ? (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">{bizSettings.business_name}</p>
            <p className="text-xs text-blue-600">{[bizSettings.phone, bizSettings.email].filter(Boolean).join(' · ')}</p>
          </div>
          <a href="/settings" className="text-xs text-blue-600 hover:text-blue-800 underline">Edit</a>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <p className="text-sm text-amber-800">Business info not set. <a href="/settings" className="underline font-medium">Add it in Settings</a> — it appears on your PDF invoices.</p>
        </div>
      )}

      {/* Project + Invoice details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider text-gray-500">Invoice Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
            <select value={selectedProjectId} onChange={e => handleProjectChange(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select a project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title} — {p.clients?.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {selectedProject && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm bg-gray-50 rounded-lg p-3">
            <div><span className="text-gray-500">Client:</span> <span className="font-medium">{selectedProject.clients?.name}</span></div>
            {selectedProject.job_type && <div><span className="text-gray-500">Job Type:</span> <span className="font-medium">{selectedProject.job_type}</span></div>}
            {selectedProject.location_address && <div><span className="text-gray-500">Location:</span> <span className="font-medium">{selectedProject.location_address}</span></div>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select value={currency} onChange={e => { setCurrency(e.target.value as 'JMD' | 'USD'); setUseGct(e.target.value === 'JMD') }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="JMD">JMD</option>
              <option value="USD">USD</option>
            </select>
          </div>
          {currency === 'JMD' && (
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button type="button" onClick={() => setUseGct(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${useGct ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useGct ? 'translate-x-4' : ''}`} />
                </button>
                <span className="text-sm text-gray-600">Apply GCT (15%)</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Line Items</h2>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
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
                  className="col-span-5 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(item.tempId, 'quantity', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(item.tempId, 'unit_price', e.target.value)}
                  placeholder="0.00"
                  className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="col-span-1 text-sm text-gray-700 text-right font-medium">{fmt(amt)}</span>
                <button type="button" onClick={() => setLineItems(p => p.filter(i => i.tempId !== item.tempId))}
                  disabled={lineItems.length <= 1} className="col-span-1 text-gray-400 hover:text-red-500 disabled:opacity-20 text-lg leading-none text-center">×</button>
              </div>
            )
          })}
        </div>
        <button type="button" onClick={() => setLineItems(p => [...p, newItem()])}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add Line Item</button>
      </div>

      {/* Discount + Additions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Discount</h2>
          <select value={discountType} onChange={e => { setDiscountType(e.target.value as DiscountType); setDiscountValue('') }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="none">No Discount</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount ({currency})</option>
          </select>
          {discountType !== 'none' && (
            <input type="number" min="0" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percentage' ? 'e.g. 10' : '0.00'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Additions</h2>
          <input value={additionsDesc} onChange={e => setAdditionsDesc(e.target.value)}
            placeholder="e.g. Rush fee, Materials"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="number" min="0" step="0.01" value={additionsAmount} onChange={e => setAdditionsAmount(e.target.value)}
            placeholder={`Amount (${currency})`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Notes + Amount Paid */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Payment terms, bank details..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount Already Paid ({currency})</label>
          <input type="number" min="0" step="0.01" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-xs text-gray-400 mt-1">Leave 0 if nothing has been paid yet</p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
        {discountAmount > 0 && <div className="flex justify-between text-gray-600"><span>Discount</span><span>- {fmt(discountAmount)}</span></div>}
        {useGct && <div className="flex justify-between text-gray-600"><span>GCT (15%)</span><span>{fmt(gctAmount)}</span></div>}
        {additionsNum > 0 && <div className="flex justify-between text-gray-600"><span>{additionsDesc || 'Additions'}</span><span>+ {fmt(additionsNum)}</span></div>}
        <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t border-gray-200"><span>Total</span><span>{fmt(total)}</span></div>
        {amountPaidNum > 0 && <div className="flex justify-between text-green-600"><span>Paid</span><span>{fmt(amountPaidNum)}</span></div>}
        {amountPaidNum > 0 && <div className="flex justify-between font-semibold text-amber-600"><span>Owing</span><span>{fmt(owing)}</span></div>}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button type="submit" disabled={isPending || !selectedProjectId}
          className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
          {isPending ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  )
}
