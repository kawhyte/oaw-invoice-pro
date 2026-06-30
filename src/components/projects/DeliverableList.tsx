'use client'
import { useTransition } from 'react'
import { FileText } from 'lucide-react'
import { StatusChip } from '@/components/ui/StatusChip'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import {
  toggleDeliverableUnlockAction,
  deleteDeliverableAction,
} from '@/app/(dashboard)/projects/[id]/actions'

export interface DeliverableRow {
  id: string
  name: string
  page_count: number | null
  manual_unlock: boolean
  unlocked: boolean
  gateLabel: string
  warn?: boolean
}

interface Props { projectId: string; deliverables: DeliverableRow[] }

export function DeliverableList({ projectId, deliverables }: Props) {
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()

  function handleToggle(d: DeliverableRow) {
    startTransition(async () => { await toggleDeliverableUnlockAction(d.id, projectId, d.manual_unlock) })
  }

  async function handleDelete(d: DeliverableRow) {
    if (!(await confirm({
      title: 'Delete this drawing?',
      description: 'This removes the original and all preview pages from the client’s shared view.',
      confirmLabel: 'Delete',
      variant: 'danger',
    }))) return
    startTransition(async () => { await deleteDeliverableAction(d.id, projectId) })
  }

  if (deliverables.length === 0) {
    return <p className="text-sm text-gray-400">No drawings uploaded yet.</p>
  }

  return (
    <div className="space-y-3">
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
