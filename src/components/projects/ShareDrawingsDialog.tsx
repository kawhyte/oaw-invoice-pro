'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { updateReviewAction } from '@/app/(dashboard)/projects/[id]/actions'
import { buildDetail } from '@/lib/buildDetail'
import { MAX_REVIEW_DAYS } from '@/lib/deliverables'
import { shareLink, whatsAppUrl } from '@/lib/share'
import { toErrorMessage } from '@/components/ui/Toast'
import type { DeliverableRow } from './DeliverableList'
import type { ReviewLevel } from '@/types'

export interface ShareContext {
  shareUrl: string
  projectTitle: string
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
  /** Baked into every full-detail image. */
  sampleWatermark: string
}

interface Props {
  projectId: string
  drawings: DeliverableRow[]
  initialIds: string[]
  share: ShareContext
  onClose: () => void
}

const DAY_CHOICES = [5, 7, 14]

export function ShareDrawingsDialog({ projectId, drawings, initialIds, share, onClose }: Props) {
  const only = initialIds.length === 1 ? drawings.find(d => d.id === initialIds[0]) : undefined
  const [ids, setIds] = useState<string[]>(initialIds)
  const [level, setLevel] = useState<ReviewLevel>(only?.reviewLevel ?? 'basic')
  const [days, setDays] = useState<string>('7') // '' = custom being typed
  const [noLimit, setNoLimit] = useState(false)
  const [download, setDownload] = useState(only?.allowDownload ?? false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const dayCount = Number(days)
  const daysOk = noLimit || (Number.isInteger(dayCount) && dayCount >= 1 && dayCount <= MAX_REVIEW_DAYS)
  const chosen = drawings.filter(d => ids.includes(d.id))
  const toBuild = level === 'detail' ? chosen.filter(d => !d.hasDetail) : []
  const payments = [...new Set(chosen.map(d => d.paymentLabel))]

  const message = `Hi${share.clientName ? ` ${share.clientName}` : ''}, your drawings for "${share.projectTitle}" are ready to view${noLimit ? '' : ` for the next ${dayCount} day${dayCount === 1 ? '' : 's'}`}: ${share.shareUrl}`

  async function handleSave() {
    setError(null)
    setBusy('Saving…')
    try {
      for (const d of toBuild) {
        const prefix = toBuild.length > 1 ? `${d.name}: ` : ''
        await buildDetail(projectId, d.id, share.sampleWatermark, msg => setBusy(prefix + msg))
      }
      setBusy('Saving…')
      await updateReviewAction(projectId, ids, { level, days: noLimit ? null : dayCount, allowDownload: download })
      setSaved(true)
    } catch (err) {
      console.error('[share-drawings]', err)
      setError(toErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleCopy() {
    try { await navigator.clipboard.writeText(share.shareUrl); setCopied(true) } catch { setError('Couldn’t copy the link.') }
  }
  async function handleShare() {
    if ((await shareLink(share.shareUrl, share.projectTitle, message)) === 'copied') setCopied(true)
  }

  const optionCls = (on: boolean) =>
    `w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${on ? 'border-[#715a3e] bg-[#f5ede4]' : 'border-[#e0e0e3] hover:bg-[#f8f9fa]'}`
  const chipCls = (on: boolean) =>
    `px-3 py-2 text-sm rounded-lg border transition-colors ${on ? 'border-[#715a3e] bg-[#f5ede4] text-[#715a3e] font-medium' : 'border-[#e0e0e3] text-[#5a5c62] hover:bg-[#f8f9fa]'}`
  const sendCls = 'px-3 py-2.5 text-sm text-center border border-[#e0e0e3] hover:bg-[#f8f9fa] text-[#1a1c1e] rounded-lg transition-colors'

  return (
    <div className="fixed inset-0 m-0! z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Share drawings" onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e0e0e3] shrink-0">
          <h3 className="font-semibold text-[#1a1c1e]">{saved ? 'Ready to send' : 'Share drawings'}</h3>
          <button onClick={onClose} disabled={!!busy} aria-label="Close" className="p-1 text-[#8a8c94] hover:text-[#1a1c1e] disabled:opacity-40"><X className="w-5 h-5" /></button>
        </div>

        {saved ? (
          <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4">
            <p className="text-sm text-[#5a5c62]">
              Saved. The client’s link is the same as before, so anyone who already has it sees the change now.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a href={whatsAppUrl(message, share.clientPhone)} target="_blank" rel="noopener noreferrer" className={sendCls}>WhatsApp</a>
              <a href={`mailto:${share.clientEmail ?? ''}?subject=${encodeURIComponent(`Drawings: ${share.projectTitle}`)}&body=${encodeURIComponent(message)}`} className={sendCls}>Email</a>
              <button onClick={handleCopy} className={sendCls}>{copied ? '✓ Copied' : 'Copy link'}</button>
              <button onClick={handleShare} className={sendCls}>More…</button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button onClick={onClose} className="btn-primary w-full py-2.5 text-sm">Done</button>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-5 overflow-y-auto">
              <fieldset disabled={!!busy} className="space-y-2">
                <legend className="label-caps mb-2">Drawings</legend>
                {drawings.map(d => (
                  <label key={d.id} className="flex items-center gap-3 py-1 cursor-pointer">
                    <input type="checkbox" checked={ids.includes(d.id)} className="w-4 h-4 accent-[#715a3e]"
                      onChange={e => setIds(p => e.target.checked ? [...p, d.id] : p.filter(x => x !== d.id))} />
                    <span className="text-sm text-[#1a1c1e] truncate">{d.name}</span>
                  </label>
                ))}
              </fieldset>

              <fieldset disabled={!!busy} className="space-y-2">
                <legend className="label-caps mb-2">How much they can see</legend>
                <button type="button" aria-pressed={level === 'basic'} onClick={() => setLevel('basic')} className={optionCls(level === 'basic')}>
                  <span className="block text-sm font-medium text-[#1a1c1e]">Basic preview</span>
                  <span className="block text-xs text-[#8a8c94]">The layout. Small text stays hard to read.</span>
                </button>
                <button type="button" aria-pressed={level === 'detail'} onClick={() => setLevel('detail')} className={optionCls(level === 'detail')}>
                  <span className="block text-sm font-medium text-[#1a1c1e]">Full detail</span>
                  <span className="block text-xs text-[#8a8c94]">Every dimension, with zoom and a light SAMPLE watermark.</span>
                </button>
                {level === 'detail' && payments.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {payments.map(p => <p key={p}>{p}</p>)}
                  </div>
                )}
                {toBuild.length > 0 && (
                  <p className="text-xs text-[#8a8c94]">The sharp version is made on this device the first time, so keep the app open until it finishes.</p>
                )}
              </fieldset>

              <fieldset disabled={!!busy}>
                <legend className="label-caps mb-2">Available for</legend>
                <div className="flex flex-wrap gap-2 items-center">
                  {DAY_CHOICES.map(n => (
                    <button key={n} type="button" aria-pressed={!noLimit && dayCount === n} onClick={() => { setNoLimit(false); setDays(String(n)) }}
                      className={chipCls(!noLimit && dayCount === n)}>{n} days</button>
                  ))}
                  <label className="flex items-center gap-1.5 text-sm text-[#5a5c62]">
                    <input type="text" inputMode="numeric" aria-label="Number of days" value={noLimit ? '' : days} placeholder="—"
                      onChange={e => { setNoLimit(false); setDays(e.target.value.replace(/\D/g, '').slice(0, 3)) }}
                      className="w-14 px-2 py-2 border border-[#e0e0e3] rounded-lg text-sm text-center focus:outline-none focus:border-[#715a3e]" /> days
                  </label>
                  <button type="button" aria-pressed={noLimit} onClick={() => setNoLimit(true)} className={chipCls(noLimit)}>No limit</button>
                </div>
                {!daysOk && <p className="text-xs text-red-500 mt-1">Enter 1 to {MAX_REVIEW_DAYS} days.</p>}
                <p className="text-xs text-[#8a8c94] mt-2">Counts from today. When time is up only these drawings close; the rest of the link keeps working.</p>
              </fieldset>

              {level === 'detail' && (
                <label className="flex items-start justify-between gap-4 cursor-pointer">
                  <span>
                    <span className="block text-sm font-medium text-[#1a1c1e]">Allow sample download</span>
                    <span className="block text-xs text-[#8a8c94]">A watermarked PDF. Once downloaded, it can’t be taken back.</span>
                  </span>
                  <button type="button" role="switch" aria-checked={download} aria-label="Allow sample download" disabled={!!busy} onClick={() => setDownload(v => !v)}
                    className={`relative w-9 h-5 mt-0.5 shrink-0 rounded-full transition-colors ${download ? 'bg-[#715a3e]' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${download ? 'translate-x-4' : ''}`} />
                  </button>
                </label>
              )}
            </div>
            <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] border-t border-[#e0e0e3] shrink-0 space-y-2">
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button onClick={handleSave} disabled={!!busy || ids.length === 0 || !daysOk}
                className="btn-primary w-full py-2.5 text-sm disabled:opacity-50">{busy ?? 'Save and share'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
