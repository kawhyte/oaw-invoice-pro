'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createProposalAction, updateProposalAction } from '@/app/(dashboard)/proposals/actions'
import { lineSubtotal, computeTotals } from '@/lib/invoiceCalc'
import { addDaysToDate, todayInBusinessTz } from '@/lib/dates'
import { useToast, toErrorMessage } from '@/components/ui/Toast'
import { JOB_TYPES, PROPOSAL_CATEGORIES } from '@/types'
import type { Client, DiscountType, Proposal, ProposalItemCategory, ProposalLineItem } from '@/types'

type ClientOption = Pick<Client, 'id' | 'name' | 'phone' | 'email' | 'currency'>
interface LineItem { tempId: string; category: ProposalItemCategory | ''; description: string; quantity: string; unit_price: string }

const newItem = (category: ProposalItemCategory | '' = 'labour'): LineItem =>
  ({ tempId: crypto.randomUUID(), category, description: '', quantity: '1', unit_price: '' })

const INPUT = 'w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]'
const LABEL = 'block text-sm font-medium text-[#5a5c62] mb-1'

interface Props {
  clients: ClientOption[]
  proposal?: Proposal & { proposal_line_items: ProposalLineItem[] }
}

export function ProposalForm({ clients, proposal }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const editMode = !!proposal
  const today = todayInBusinessTz()

  const [recipientMode, setRecipientMode] = useState<'client' | 'prospect'>(proposal?.client_id ? 'client' : 'prospect')
  const [clientId, setClientId] = useState(proposal?.client_id ?? '')
  const [recipientName, setRecipientName] = useState(proposal && !proposal.client_id ? proposal.recipient_name : '')
  const [recipientPhone, setRecipientPhone] = useState(proposal && !proposal.client_id ? proposal.recipient_phone ?? '' : '')
  const [recipientEmail, setRecipientEmail] = useState(proposal && !proposal.client_id ? proposal.recipient_email ?? '' : '')
  const [title, setTitle] = useState(proposal?.title ?? '')
  const [scope, setScope] = useState(proposal?.scope ?? '')
  const [jobType, setJobType] = useState(proposal?.job_type ?? '')
  const [location, setLocation] = useState(proposal?.location_address ?? '')
  // An expired proposal opened for editing needs a new date before it can be saved.
  const [validUntil, setValidUntil] = useState(() =>
    proposal && proposal.valid_until >= today ? proposal.valid_until : addDaysToDate(today, 14))
  const [currency, setCurrency] = useState<'JMD' | 'USD'>(proposal?.currency ?? 'JMD')
  const [useGct, setUseGct] = useState(proposal ? proposal.gct_rate > 0 : false)
  const [discountType, setDiscountType] = useState<DiscountType>(proposal?.discount_type ?? 'none')
  const [discountValue, setDiscountValue] = useState(proposal?.discount_value ? String(proposal.discount_value) : '')
  const [additionsDesc, setAdditionsDesc] = useState(proposal?.additions_description ?? '')
  const [additionsAmount, setAdditionsAmount] = useState(proposal?.additions_amount ? String(proposal.additions_amount) : '')
  const [notes, setNotes] = useState(proposal?.notes ?? '')
  const [items, setItems] = useState<LineItem[]>(() =>
    proposal?.proposal_line_items?.length
      ? [...proposal.proposal_line_items].sort((a, b) => a.sort_order - b.sort_order).map(i => ({
          tempId: crypto.randomUUID(), category: i.category ?? '', description: i.description,
          quantity: String(i.quantity), unit_price: String(i.unit_price),
        }))
      : [newItem('labour')])

  const presets = [
    { label: '2 weeks', date: addDaysToDate(today, 14) },
    { label: '1 month', date: addDaysToDate(today, 30) },
  ]

  function pickClient(id: string) {
    setClientId(id)
    const c = clients.find(c => c.id === id)
    if (c?.currency && !editMode) { setCurrency(c.currency); setUseGct(c.currency === 'JMD') }
  }

  function updateItem(tempId: string, field: keyof Omit<LineItem, 'tempId'>, value: string) {
    setItems(prev => prev.map(i => i.tempId === tempId ? { ...i, [field]: value } : i))
  }

  const subtotal = lineSubtotal(items.map(i => ({ quantity: parseFloat(i.quantity) || 0, unit_price: parseFloat(i.unit_price) || 0 })))
  const additionsNum = parseFloat(additionsAmount) || 0
  const { discountAmount, gctAmount, total } = computeTotals({
    subtotal, discountType, discountValue: parseFloat(discountValue) || 0, gctRate: useGct ? 0.15 : 0, additionsAmount: additionsNum,
  })
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Client-side checks mirror the server's (production hides thrown action messages).
    if (recipientMode === 'client' && !clientId) return toast.error('Pick a client, or switch to “New prospect”.')
    if (recipientMode === 'prospect' && !recipientName.trim()) return toast.error('Add the prospect’s name.')
    if (!title.trim()) return toast.error('Give the proposal a title.')
    if (!validUntil || validUntil < today) return toast.error('“Valid until” must be today or later.')
    const valid = items.filter(i => i.description.trim())
    if (!valid.length) return toast.error('Add at least one line item.')
    if (valid.some(i => !(parseFloat(i.quantity) > 0))) return toast.error('Every quantity must be more than 0.')

    const fd = new FormData()
    fd.set('client_id', recipientMode === 'client' ? clientId : '')
    fd.set('recipient_name', recipientMode === 'prospect' ? recipientName : '')
    fd.set('recipient_phone', recipientMode === 'prospect' ? recipientPhone : '')
    fd.set('recipient_email', recipientMode === 'prospect' ? recipientEmail : '')
    fd.set('title', title)
    fd.set('scope', scope)
    fd.set('job_type', jobType)
    fd.set('location_address', location)
    fd.set('valid_until', validUntil)
    fd.set('currency', currency)
    fd.set('use_gct', String(useGct))
    fd.set('discount_type', discountType)
    fd.set('discount_value', discountValue)
    fd.set('additions_description', additionsDesc)
    fd.set('additions_amount', additionsAmount)
    fd.set('notes', notes)
    fd.set('line_items', JSON.stringify(valid.map(i => ({
      category: i.category || null,
      description: i.description.trim(),
      quantity: parseFloat(i.quantity) || 1,
      unit_price: parseFloat(i.unit_price) || 0,
    }))))

    startTransition(async () => {
      try {
        if (proposal) {
          await updateProposalAction(proposal.id, fd)
          toast.success('Proposal saved.')
          router.push(`/proposals/${proposal.id}`)
        } else {
          const id = await createProposalAction(fd)
          router.push(`/proposals/${id}`)
        }
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Recipient */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-4 sm:p-6 space-y-4">
        <h2 className="label-caps">Prepared for</h2>
        <div className="inline-flex rounded-lg border border-[#e0e0e3] p-0.5 bg-[#f8f9fa]">
          {(['prospect', 'client'] as const).map(m => (
            <button key={m} type="button" onClick={() => setRecipientMode(m)} disabled={m === 'client' && clients.length === 0}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-40 ${recipientMode === m ? 'bg-white shadow-sm text-[#1a1c1e] font-medium' : 'text-[#5a5c62]'}`}>
              {m === 'prospect' ? 'New prospect' : 'Existing client'}
            </button>
          ))}
        </div>
        {recipientMode === 'client' ? (
          <select aria-label="Client" value={clientId} onChange={e => pickClient(e.target.value)} className={`${INPUT} select-field`}>
            <option value="">Select a client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Name *</label>
              <input aria-label="Prospect name" value={recipientName} onChange={e => setRecipientName(e.target.value)} maxLength={200} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Phone (WhatsApp)</label>
              <input aria-label="Prospect phone" type="tel" value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} maxLength={50} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Email</label>
              <input aria-label="Prospect email" type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} maxLength={200} className={INPUT} />
            </div>
          </div>
        )}
      </div>

      {/* Job */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-4 sm:p-6 space-y-4">
        <h2 className="label-caps">The job</h2>
        <div>
          <label className={LABEL}>Title *</label>
          <input aria-label="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="e.g. 3-bedroom house — working drawings" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Scope of work</label>
          <textarea aria-label="Scope of work" value={scope} onChange={e => setScope(e.target.value)} rows={4} maxLength={5000}
            placeholder="What's included: drawings, site visits, revisions…" className={`${INPUT} resize-y`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Job type</label>
            <select aria-label="Job type" value={jobType} onChange={e => setJobType(e.target.value)} className={`${INPUT} select-field`}>
              <option value="">—</option>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Location</label>
            <input aria-label="Location" value={location} onChange={e => setLocation(e.target.value)} maxLength={300} placeholder="Address or area" className={INPUT} />
          </div>
        </div>
      </div>

      {/* Validity */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-4 sm:p-6 space-y-3">
        <h2 className="label-caps">Valid until</h2>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map(p => (
            <button key={p.label} type="button" onClick={() => setValidUntil(p.date)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${validUntil === p.date ? 'bg-[#715a3e] text-white border-[#715a3e]' : 'border-[#e0e0e3] text-[#1a1c1e] hover:bg-[#f8f9fa]'}`}>
              {p.label}
            </button>
          ))}
          <input aria-label="Valid until" type="date" value={validUntil} min={today} onChange={e => setValidUntil(e.target.value)}
            className="px-3 py-1.5 border border-[#e0e0e3] rounded-lg text-sm bg-white focus:outline-none focus:border-[#715a3e]" />
        </div>
      </div>

      {/* Currency */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Currency</label>
            <select aria-label="Currency" value={currency} onChange={e => { setCurrency(e.target.value as 'JMD' | 'USD'); setUseGct(e.target.value === 'JMD') }} className={`${INPUT} select-field`}>
              <option value="JMD">JMD</option>
              <option value="USD">USD</option>
            </select>
          </div>
          {currency === 'JMD' && (
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button type="button" onClick={() => setUseGct(v => !v)} aria-pressed={useGct} aria-label="Apply GCT (15%)"
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${useGct ? 'bg-[#715a3e]' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useGct ? 'translate-x-4' : ''}`} />
                </button>
                <span className="text-sm text-[#5a5c62]">GCT (15%)</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Line items — stacked cards on phones, one row on wider screens */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-4 sm:p-6 space-y-3">
        <h2 className="label-caps">Labour, equipment & materials</h2>
        <div className="space-y-3">
          {items.map(item => {
            const amt = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
            return (
              <div key={item.tempId} className="rounded-lg border border-[#e0e0e3] bg-[#f8f9fa] p-3 grid grid-cols-6 sm:grid-cols-12 gap-2 items-end">
                <div className="col-span-3 sm:col-span-2">
                  <label className="block text-xs text-[#8a8c94] mb-1">Type</label>
                  <select aria-label="Item type" value={item.category} onChange={e => updateItem(item.tempId, 'category', e.target.value)} className={`${INPUT} select-field`}>
                    {PROPOSAL_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    <option value="">Other</option>
                  </select>
                </div>
                <div className="col-span-3 sm:col-span-1 flex justify-end sm:order-last">
                  <button type="button" onClick={() => setItems(p => p.filter(i => i.tempId !== item.tempId))}
                    disabled={items.length <= 1} aria-label="Remove item"
                    className="px-2 py-1 text-gray-400 hover:text-red-500 disabled:opacity-20 text-xl leading-none">×</button>
                </div>
                <div className="col-span-6 sm:col-span-4">
                  <label className="block text-xs text-[#8a8c94] mb-1">Description</label>
                  <input aria-label="Item description" value={item.description} onChange={e => updateItem(item.tempId, 'description', e.target.value)} maxLength={500}
                    placeholder="e.g. Site visit & measured survey" className={INPUT} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-[#8a8c94] mb-1">Qty</label>
                  <input aria-label="Quantity" type="number" inputMode="decimal" min="0.01" step="0.01" value={item.quantity}
                    onChange={e => updateItem(item.tempId, 'quantity', e.target.value)} className={`${INPUT} text-center data-mono`} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="block text-xs text-[#8a8c94] mb-1">Unit price</label>
                  <input aria-label="Unit price" type="number" inputMode="decimal" min="0" step="0.01" value={item.unit_price} placeholder="0.00"
                    onChange={e => updateItem(item.tempId, 'unit_price', e.target.value)} className={`${INPUT} data-mono`} />
                </div>
                <div className="col-span-6 sm:col-span-2 text-right text-sm font-medium text-[#1a1c1e] data-mono pb-2 truncate">{fmt(amt)}</div>
              </div>
            )
          })}
        </div>
        <button type="button" onClick={() => setItems(p => [...p, newItem((p[p.length - 1]?.category as ProposalItemCategory) || 'labour')])}
          className="text-sm text-[#715a3e] hover:text-[#8b7355] font-medium">+ Add line item</button>
      </div>

      {/* Discount + additions */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="label-caps">Discount</h2>
          <select value={discountType} onChange={e => { setDiscountType(e.target.value as DiscountType); setDiscountValue('') }} className={`${INPUT} select-field`}>
            <option value="none">No discount</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed amount ({currency})</option>
          </select>
          {discountType !== 'none' && (
            <input type="number" inputMode="decimal" min="0" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percentage' ? 'e.g. 10' : '0.00'} className={INPUT} />
          )}
        </div>
        <div className="space-y-3">
          <h2 className="label-caps">Additions</h2>
          <input value={additionsDesc} onChange={e => setAdditionsDesc(e.target.value)} maxLength={200} placeholder="e.g. Rush fee" className={INPUT} />
          <input type="number" inputMode="decimal" min="0" step="0.01" value={additionsAmount} onChange={e => setAdditionsAmount(e.target.value)}
            placeholder={`Amount (${currency})`} className={INPUT} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-4 sm:p-6">
        <label className={LABEL}>Notes for the client</label>
        <textarea aria-label="Notes for the client" value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={2000}
          placeholder="Payment terms, what's not included…" className={`${INPUT} resize-y`} />
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-4 sm:p-6 space-y-2 text-sm">
        <div className="flex justify-between text-[#5a5c62]"><span>Subtotal</span><span className="data-mono">{fmt(subtotal)}</span></div>
        {discountAmount > 0 && <div className="flex justify-between text-[#5a5c62]"><span>Discount</span><span className="data-mono">- {fmt(discountAmount)}</span></div>}
        {useGct && <div className="flex justify-between text-[#5a5c62]"><span>GCT (15%)</span><span className="data-mono">{fmt(gctAmount)}</span></div>}
        {additionsNum > 0 && <div className="flex justify-between gap-3 text-[#5a5c62]"><span className="truncate">{additionsDesc || 'Additions'}</span><span className="data-mono shrink-0">+ {fmt(additionsNum)}</span></div>}
        <div className="flex justify-between font-bold text-[#1a1c1e] text-base pt-2 border-t border-[#e0e0e3]"><span>Total</span><span className="data-mono">{fmt(total)}</span></div>
      </div>

      <div className="flex items-center gap-3">
        {editMode ? (
          <Link href={`/proposals/${proposal!.id}`} className="px-4 py-2 text-sm text-[#5a5c62] hover:text-[#1a1c1e]">← Back</Link>
        ) : (
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-[#5a5c62] hover:text-[#1a1c1e]">Cancel</button>
        )}
        <button type="submit" disabled={isPending}
          className="px-6 py-2 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50 font-medium">
          {isPending ? 'Saving…' : editMode ? 'Save changes' : 'Create proposal'}
        </button>
      </div>
    </form>
  )
}
