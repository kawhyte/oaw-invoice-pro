'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoiceAction } from '@/app/(dashboard)/invoices/actions'
import type { Client, Project } from '@/types'

interface ProjectWithClient extends Project { clients: Client | null }
interface Stage { label: string; amount: string; due_date: string }

export function InvoiceForm({ projects }: { projects: ProjectWithClient[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [currency, setCurrency] = useState('JMD')
  const [useGct, setUseGct] = useState(false)
  const [notes, setNotes] = useState('')
  const [stages, setStages] = useState<Stage[]>([
    { label: 'Deposit', amount: '', due_date: '' },
    { label: 'Final Payment', amount: '', due_date: '' },
  ])

  function handleProjectChange(id: string) {
    setSelectedProjectId(id)
    const p = projects.find(p => p.id === id)
    if (p?.clients?.currency) {
      setCurrency(p.clients.currency)
      setUseGct(p.clients.currency === 'JMD')
    }
  }

  function updateStage(i: number, field: keyof Stage, value: string) {
    setStages(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  const subtotal = stages.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const gctAmount = useGct ? subtotal * 0.15 : 0
  const total = subtotal + gctAmount
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validStages = stages
      .filter(s => s.label.trim() && parseFloat(s.amount) > 0)
      .map(s => ({ label: s.label.trim(), amount: parseFloat(s.amount), due_date: s.due_date }))
    if (!selectedProjectId || !validStages.length) return

    const fd = new FormData()
    fd.set('project_id', selectedProjectId)
    fd.set('currency', currency)
    fd.set('use_gct', String(useGct))
    fd.set('notes', notes)
    fd.set('payment_stages', JSON.stringify(validStages))

    startTransition(async () => {
      const invoiceId = await createInvoiceAction(fd)
      router.push(`/invoices/${invoiceId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Invoice Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
          <select value={selectedProjectId} onChange={e => handleProjectChange(e.target.value)} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select a project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title} — {p.clients?.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select value={currency} onChange={e => { setCurrency(e.target.value); setUseGct(e.target.value === 'JMD') }}
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Payment Terms</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Bank details, payment instructions, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Payment Stages */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Payment Schedule</h2>
        <div className="space-y-3">
          {stages.map((stage, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>}
                <input value={stage.label} onChange={e => updateStage(i, 'label', e.target.value)}
                  placeholder="e.g. Deposit"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-3">
                {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>}
                <input type="number" min="0" step="0.01" value={stage.amount} onChange={e => updateStage(i, 'amount', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-4">
                {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>}
                <input type="date" value={stage.due_date} onChange={e => updateStage(i, 'due_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-1 flex justify-center pb-1">
                <button type="button" onClick={() => setStages(p => p.filter((_, idx) => idx !== i))}
                  disabled={stages.length <= 1} className="text-gray-400 hover:text-red-500 disabled:opacity-30 text-xl leading-none">×</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setStages(p => [...p, { label: '', amount: '', due_date: '' }])}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add stage</button>

        {/* Totals */}
        <div className="border-t border-gray-100 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span><span>{fmt(subtotal)}</span>
          </div>
          {useGct && (
            <div className="flex justify-between text-gray-600">
              <span>GCT (15%)</span><span>{fmt(gctAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-900 text-base pt-2 border-t border-gray-100">
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </div>
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
