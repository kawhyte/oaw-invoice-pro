'use client'
import { useTransition } from 'react'
import { FileText } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast, toErrorMessage } from '@/components/ui/Toast'
import { deleteProposalDrawingAction } from '@/app/(dashboard)/proposals/actions'

interface Row { id: string; name: string; page_count: number | null }

export function ProposalDrawingList({ proposalId, drawings, editable }: { proposalId: string; drawings: Row[]; editable: boolean }) {
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()
  const toast = useToast()

  async function handleDelete(d: Row) {
    if (!(await confirm({ title: 'Delete this drawing?', description: 'It disappears from the client’s proposal link.', confirmLabel: 'Delete', variant: 'danger' }))) return
    startTransition(async () => {
      try { await deleteProposalDrawingAction(d.id, proposalId) } catch (err) { toast.error(toErrorMessage(err)) }
    })
  }

  if (drawings.length === 0) return <p className="text-sm text-gray-400">No drawings attached.</p>
  return (
    <div className="divide-y divide-gray-100">
      {drawings.map(d => (
        <div key={d.id} className="flex items-center justify-between gap-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} className="text-[#715a3e] shrink-0" />
            <span className="text-sm text-[#1a1c1e] truncate">{d.name}</span>
            {d.page_count != null && <span className="text-xs text-[#8a8c94] shrink-0">{d.page_count} pg</span>}
          </div>
          {editable && (
            <button onClick={() => handleDelete(d)} disabled={isPending} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0">
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
