'use client'
import { useState, useTransition } from 'react'
import { FileText } from 'lucide-react'
import { StatusChip } from '@/components/ui/StatusChip'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast, toErrorMessage } from '@/components/ui/Toast'
import {
  toggleDeliverableUnlockAction,
  deleteDeliverableAction,
  extendReviewAction,
  endReviewAction,
} from '@/app/(dashboard)/projects/[id]/actions'
import { ShareDrawingsDialog, type ShareContext } from './ShareDrawingsDialog'
import type { ReviewLevel } from '@/types'

export interface DeliverableRow {
  id: string
  name: string
  page_count: number | null
  manual_unlock: boolean
  unlocked: boolean
  gateLabel: string
  warn?: boolean
  reviewLevel: ReviewLevel
  hasDetail: boolean
  allowDownload: boolean
  /** Has a time limit (whether or not it has passed). */
  limited: boolean
  ended: boolean
  /** e.g. "Full detail · 4 days left · Download off". */
  reviewLabel: string
  /** e.g. "INV-202: JMD 50,000 paid of 120,000". */
  paymentLabel: string
}

interface Props { projectId: string; deliverables: DeliverableRow[]; share: ShareContext }

const EXTEND_DAYS = 7

export function DeliverableList({ projectId, deliverables, share }: Props) {
  const [sharing, setSharing] = useState<string[] | null>(null)
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()
  const toast = useToast()

  function handleToggle(d: DeliverableRow) {
    startTransition(async () => {
      try {
        await toggleDeliverableUnlockAction(d.id, projectId, d.manual_unlock)
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try { await action() } catch (err) { toast.error(toErrorMessage(err)) }
    })
  }

  async function handleEnd(d: DeliverableRow) {
    if (!(await confirm({
      title: 'End this review now?',
      description: 'The client can no longer view this drawing. You can extend it again any time; the link stays the same.',
      confirmLabel: 'End review',
    }))) return
    run(() => endReviewAction(projectId, d.id))
  }

  async function handleDelete(d: DeliverableRow) {
    if (!(await confirm({
      title: 'Delete this drawing?',
      description: 'This removes the original and all preview pages from the client’s shared view.',
      confirmLabel: 'Delete',
      variant: 'danger',
    }))) return
    startTransition(async () => {
      try {
        await deleteDeliverableAction(d.id, projectId)
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  if (deliverables.length === 0) {
    return <p className="text-sm text-gray-400">No drawings uploaded yet.</p>
  }

  // Paid/released drawings are already fully open, so there's nothing to limit.
  const reviewable = deliverables.filter(d => !d.unlocked)

  return (
    <div className="space-y-3">
      {reviewable.length > 0 && (
        <button onClick={() => setSharing(reviewable.map(d => d.id))} disabled={isPending}
          className="btn-primary px-3 py-2 text-sm w-full sm:w-auto disabled:opacity-50">Share drawings</button>
      )}
      {sharing && (
        <ShareDrawingsDialog projectId={projectId} drawings={reviewable} initialIds={sharing} share={share} onClose={() => setSharing(null)} />
      )}
      {deliverables.map(d => (
        <div key={d.id} className="flex flex-col gap-2 py-3 border-b border-gray-50 last:border-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <FileText className="w-4 h-4 text-[#715a3e] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[#1a1c1e] truncate">{d.name}</span>
                <StatusChip status={d.unlocked ? 'unlocked' : 'locked'} />
              </div>
              <p className="text-xs mt-0.5">
                <span className="text-[#8a8c94]">{d.page_count ? `${d.page_count} page${d.page_count !== 1 ? 's' : ''} · ` : ''}</span>
                <span className={d.warn ? 'text-amber-700 font-medium' : 'text-[#8a8c94]'}>{d.warn ? '⚠ ' : ''}{d.gateLabel}</span>
              </p>
              {!d.unlocked && (
                <>
                  <p className={`text-xs mt-0.5 ${d.ended ? 'text-amber-700 font-medium' : 'text-[#5a5c62]'}`}>{d.reviewLabel}</p>
                  <div className="flex flex-wrap gap-x-4 text-xs">
                    <button onClick={() => setSharing([d.id])} disabled={isPending} className="py-1.5 text-[#715a3e] hover:text-[#8b7355] font-medium disabled:opacity-50">Change</button>
                    {d.limited && (
                      <button onClick={() => run(() => extendReviewAction(projectId, d.id, EXTEND_DAYS))} disabled={isPending} className="py-1.5 text-[#715a3e] hover:text-[#8b7355] font-medium disabled:opacity-50">Extend {EXTEND_DAYS} days</button>
                    )}
                    {!d.ended && (
                      <button onClick={() => handleEnd(d)} disabled={isPending} className="py-1.5 text-red-400 hover:text-red-600 disabled:opacity-50">End now</button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0 pl-7 sm:pl-0">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-[#5a5c62]">Release to client</span>
              <button type="button" role="switch" aria-checked={d.manual_unlock} onClick={() => handleToggle(d)} disabled={isPending}
                className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${d.manual_unlock ? 'bg-[#715a3e]' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${d.manual_unlock ? 'translate-x-4' : ''}`} />
              </button>
            </label>
            <button onClick={() => handleDelete(d)} disabled={isPending}
              className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
