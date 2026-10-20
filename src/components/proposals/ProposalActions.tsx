'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Copy, Check, Share2, MessageCircle, X } from 'lucide-react'
import {
  sendProposalAction, renewProposalAction, markAcceptedAction, markDeclinedAction, deleteProposalAction,
  undoConversionAction,
} from '@/app/(dashboard)/proposals/actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast, toErrorMessage } from '@/components/ui/Toast'
import { canShareFiles, shareFile, shareLink, whatsAppUrl } from '@/lib/share'
import { addDaysToDate } from '@/lib/dates'
import { isEditable } from '@/lib/proposals'
import { ConvertProposalDialog } from './ConvertProposalDialog'
import type { ProposalStatus } from '@/types'

interface Props {
  id: string
  number: string
  title: string
  status: ProposalStatus
  shareToken: string
  origin: string
  hasVersion: boolean
  unsentChanges: boolean
  recipientName: string
  recipientPhone: string | null
  isNewClient: boolean
  validUntil: string
  validUntilLabel: string
  daysLeft: number
  today: string
  acceptedTotal: string
  drawingCount: number
  /** Converted only: whether the invoice it created still exists. */
  invoiceNumber: string | null
}

const BTN = 'px-3 py-1.5 text-sm border border-[#e0e0e3] rounded-lg text-[#1a1c1e] hover:bg-[#f8f9fa] disabled:opacity-50 transition-colors'
const PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50 transition-colors'

export function ProposalActions(p: Props) {
  const confirm = useConfirm()
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [shareOpen, setShareOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [renewDate, setRenewDate] = useState(addDaysToDate(p.today, 14))
  const [copied, setCopied] = useState(false)
  const [pdfReady, setPdfReady] = useState<File | null>(null)
  const [sharingPdf, setSharingPdf] = useState(false)

  const editable = isEditable(p.status)
  const expired = p.status === 'expired'
  const shareUrl = `${p.origin}/share/proposal/${p.shareToken}`
  const message = `Hi ${p.recipientName}, here is your proposal ${p.number} — “${p.title}”. It’s valid until ${p.validUntilLabel}. You can review it and accept or ask for changes here: ${shareUrl}`

  function run(fn: () => Promise<unknown>, success?: string, after?: () => void) {
    startTransition(async () => {
      try {
        await fn()
        if (success) toast.success(success)
        after?.()
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  function handleSend() {
    if (expired) { setRenewOpen(true); return }
    run(() => sendProposalAction(p.id), undefined, () => setShareOpen(true))
  }

  async function handleShareLink() {
    const r = await shareLink(shareUrl, `Proposal ${p.number}`, message)
    if (r === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Same two-tap fallback as invoices: if generating the PDF outlasts the tap's
  // user activation, keep the file and ask for a second tap that shares instantly.
  async function handleSharePdf() {
    if (!canShareFiles()) { window.open(`/api/proposal/${p.id}/pdf`, '_blank'); return }
    setSharingPdf(true)
    try {
      let file = pdfReady
      if (!file) {
        const res = await fetch(`/api/proposal/${p.id}/pdf`)
        if (!res.ok) throw new Error('Could not generate the PDF.')
        file = new File([await res.blob()], `${p.number}.pdf`, { type: 'application/pdf' })
      }
      const result = await shareFile(file, `Proposal ${p.number}`, message)
      if (result === 'needs-gesture') { setPdfReady(file); toast.success('PDF ready — tap Share PDF again.'); return }
      setPdfReady(null)
    } catch (err) {
      toast.error(toErrorMessage(err))
    } finally {
      setSharingPdf(false)
    }
  }

  async function handleAccept() {
    if (!(await confirm({
      title: 'Mark as accepted?',
      description: p.unsentChanges || !p.hasVersion
        ? 'Use this when the client agreed outside the app. Your current (unsent) content is saved as the accepted version.'
        : 'Use this when the client agreed outside the app (e.g. on WhatsApp).',
      confirmLabel: 'Mark accepted', variant: 'default',
    }))) return
    run(() => markAcceptedAction(p.id), 'Marked as accepted.')
  }

  async function handleDecline() {
    if (!(await confirm({ title: 'Mark as declined?', description: 'The client link will show the proposal as closed.', confirmLabel: 'Mark declined' }))) return
    run(() => markDeclinedAction(p.id), 'Marked as declined.')
  }

  async function handleUndoConversion() {
    if (!(await confirm({
      title: 'Undo conversion?',
      description: `${p.number} goes back to Accepted so you can change it or convert it again. ${p.invoiceNumber ? `Draft invoice ${p.invoiceNumber} is deleted` : 'Its invoice is already gone'}, and the project it created is removed too — unless you’ve added files, notes, tasks or other invoices to it, in which case the project is kept.`,
      confirmLabel: 'Undo conversion', variant: 'default',
    }))) return
    startTransition(async () => {
      try {
        const r = await undoConversionAction(p.id)
        toast.success(r.projectKept ? `Conversion undone. Project “${r.projectKept}” was kept because it has your own work in it.` : 'Conversion undone — back to Accepted.')
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  async function handleDelete() {
    if (!(await confirm({ title: `Delete ${p.number}?`, description: 'The proposal, its versions and drawings are removed and the client link stops working. This cannot be undone.', confirmLabel: 'Delete' }))) return
    run(() => deleteProposalAction(p.id))
  }

  function handleRenew() {
    if (!renewDate || renewDate < p.today) { toast.error('Pick today or a later date.'); return }
    run(() => renewProposalAction(p.id, renewDate), 'Validity updated.', () => setRenewOpen(false))
  }

  const sendLabel = !p.hasVersion ? 'Send' : p.unsentChanges ? 'Send update' : 'Share'
  const showRenew = editable && (expired || (p.status !== 'draft' && p.daysLeft <= 7))

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {p.status === 'accepted' && (
          <button onClick={() => setConvertOpen(true)} disabled={isPending} className={PRIMARY}>Convert to invoice</button>
        )}
        {editable && !expired && (
          <button onClick={handleSend} disabled={isPending} className={PRIMARY}>
            <Share2 size={14} /> {isPending ? 'Working…' : sendLabel}
          </button>
        )}
        {!editable && p.hasVersion && p.status !== 'declined' && (
          <button onClick={() => setShareOpen(true)} className={BTN}>Share link</button>
        )}
        {showRenew && <button onClick={() => setRenewOpen(true)} disabled={isPending} className={expired ? PRIMARY : BTN}>Renew</button>}
        {editable && <Link href={`/proposals/${p.id}/edit`} className={BTN}>Edit</Link>}
        <a href={`/api/proposal/${p.id}/pdf${p.unsentChanges && editable ? '?draft=true' : ''}`} target="_blank" rel="noopener noreferrer" className={BTN}>
          {p.unsentChanges && editable ? 'PDF (unsent draft)' : 'PDF'}
        </a>
        {editable && !expired && <button onClick={handleAccept} disabled={isPending} className={BTN}>Mark accepted</button>}
        {p.status !== 'converted' && p.status !== 'declined' && (
          <button onClick={handleDecline} disabled={isPending} className={BTN}>Mark declined</button>
        )}
        {p.status === 'converted' && (
          <button onClick={handleUndoConversion} disabled={isPending} className={BTN}>Undo conversion</button>
        )}
        {(p.status !== 'converted' || !p.invoiceNumber) && (
          <button onClick={handleDelete} disabled={isPending} className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
        )}
      </div>

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShareOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-5 z-10 space-y-4"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-[#1a1c1e]">Share {p.number}</h3>
                <p className="text-xs text-[#5a5c62] mt-0.5">Your client sees the latest sent version and can accept or ask for changes.</p>
              </div>
              <button onClick={() => setShareOpen(false)} aria-label="Close" className="text-[#8a8c94] hover:text-[#1a1c1e] shrink-0"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <a href={whatsAppUrl(message, p.recipientPhone)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-[#25D366] text-white hover:opacity-90">
                <MessageCircle size={16} /> WhatsApp{p.recipientPhone ? ` ${p.recipientName}` : ''}
              </a>
              <button onClick={handleShareLink} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-[#715a3e] text-white hover:bg-[#8b7355]">
                <Share2 size={16} /> Share link…
              </button>
              <button onClick={handleSharePdf} disabled={sharingPdf} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#e0e0e3] text-[#1a1c1e] hover:bg-[#f8f9fa] disabled:opacity-50">
                {sharingPdf ? 'Preparing PDF…' : pdfReady ? 'Share PDF now' : 'Share PDF'}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#e0e0e3] bg-[#f8f9fa] px-3 py-2">
              <span className="text-xs text-[#5a5c62] truncate flex-1 min-w-0">{shareUrl}</span>
              <button onClick={handleCopy} aria-label="Copy link" className="text-[#715a3e] shrink-0">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
            </div>
          </div>
        </div>
      )}

      {renewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !isPending && setRenewOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 z-10 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-semibold text-[#1a1c1e]">Renew {p.number}</h3>
              <p className="text-xs text-[#5a5c62] mt-1">
                {expired ? 'It expired — pick a new date and the client can respond again.' : 'Extend how long this proposal is valid.'}
                {' '}To change prices too, edit it and send an update.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[{ l: '2 weeks', d: addDaysToDate(p.today, 14) }, { l: '1 month', d: addDaysToDate(p.today, 30) }].map(o => (
                <button key={o.l} type="button" onClick={() => setRenewDate(o.d)}
                  className={`px-3 py-1.5 text-sm rounded-full border ${renewDate === o.d ? 'bg-[#715a3e] text-white border-[#715a3e]' : 'border-[#e0e0e3]'}`}>{o.l}</button>
              ))}
              <input type="date" value={renewDate} min={p.today} onChange={e => setRenewDate(e.target.value)}
                className="px-3 py-1.5 border border-[#e0e0e3] rounded-lg text-sm bg-white" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenewOpen(false)} disabled={isPending} className={BTN}>Cancel</button>
              <button onClick={handleRenew} disabled={isPending} className={PRIMARY}>{isPending ? 'Saving…' : 'Renew'}</button>
            </div>
          </div>
        </div>
      )}

      {convertOpen && (
        <ConvertProposalDialog proposalId={p.id} recipientName={p.recipientName} isNewClient={p.isNewClient}
          total={p.acceptedTotal} drawingCount={p.drawingCount} onClose={() => setConvertOpen(false)} />
      )}
    </>
  )
}
