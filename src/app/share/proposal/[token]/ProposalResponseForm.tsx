'use client'
import { useState, useTransition } from 'react'
import { acceptProposalAction, requestProposalChangesAction } from './actions'

const INPUT = 'w-full px-3 py-2.5 border border-[#e0e0e3] rounded-lg text-base text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]'

export function ProposalResponseForm({ token, version, total }: { token: string; version: number; total: string }) {
  const [mode, setMode] = useState<'idle' | 'accept' | 'changes'>('idle')
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'accepted' | 'changes' | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = mode === 'accept'
        ? await acceptProposalAction(token, version, name)
        : await requestProposalChangesAction(token, version, note, name)
      if (res.ok) setDone(mode === 'accept' ? 'accepted' : 'changes')
      else setError(res.error)
    })
  }

  if (done === 'accepted') {
    return (
      <div className="rounded-xl border border-[#2a5130]/30 bg-[#dde8dd] px-5 py-4 text-center">
        <p className="font-semibold text-[#2a5130]">Thank you — proposal accepted.</p>
        <p className="text-sm text-[#2a5130] mt-1">We’ll be in touch to get started.</p>
      </div>
    )
  }
  if (done === 'changes') {
    return (
      <div className="rounded-xl border border-[#715a3e]/30 bg-[#f5ede4] px-5 py-4 text-center">
        <p className="font-semibold text-[#715a3e]">Thanks — your note was sent.</p>
        <p className="text-sm text-[#715a3e] mt-1">You’ll get an updated proposal at this same link.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-5 space-y-4">
      <h2 className="label-caps">Your response</h2>
      {mode === 'idle' && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => setMode('accept')} className="btn-primary flex-1 px-4 py-3 text-sm rounded-lg">
            Accept proposal
          </button>
          <button onClick={() => setMode('changes')} className="btn-secondary flex-1 px-4 py-3 text-sm rounded-lg">
            Request changes
          </button>
        </div>
      )}

      {mode === 'accept' && (
        <div className="space-y-3">
          <p className="text-sm text-[#5a5c62]">
            By accepting you agree to the work and total of <span className="font-semibold text-[#1a1c1e]">{total}</span> in version {version}.
          </p>
          <label className="block">
            <span className="block text-sm font-medium text-[#5a5c62] mb-1">Your full name</span>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={100} autoComplete="name" className={INPUT} />
          </label>
        </div>
      )}

      {mode === 'changes' && (
        <div className="space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-[#5a5c62] mb-1">What would you like changed?</span>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} maxLength={2000} className={`${INPUT} resize-none`} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-[#5a5c62] mb-1">Your name (optional)</span>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={100} autoComplete="name" className={INPUT} />
          </label>
        </div>
      )}

      {mode !== 'idle' && (
        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={isPending} className="btn-primary px-5 py-2.5 text-sm rounded-lg disabled:opacity-50">
            {isPending ? 'Sending…' : mode === 'accept' ? 'Confirm acceptance' : 'Send note'}
          </button>
          <button onClick={() => { setMode('idle'); setError(null) }} disabled={isPending} className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">
            Back
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
