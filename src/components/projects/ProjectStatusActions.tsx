'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setProjectStatusAction } from '@/app/(dashboard)/projects/actions'
import { useToast, toErrorMessage } from '@/components/ui/Toast'
import type { ProjectStatus } from '@/types'

const PRIMARY = 'px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors disabled:opacity-50'
const OUTLINE = 'px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50'

function useSetStatus(projectId: string) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()
  function set(status: ProjectStatus, message: string) {
    startTransition(async () => {
      try {
        await setProjectStatusAction(projectId, status)
        router.refresh()
        toast.success(message)
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }
  return { isPending, set }
}

/**
 * One-tap status buttons on the project page. Completed and on-hold jobs drop
 * off the Workload card and out of the Active list, but nothing is deleted:
 * Reopen / Resume puts them straight back to In Progress.
 */
export function ProjectStatusActions({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const { isPending, set } = useSetStatus(projectId)

  if (status === 'complete') {
    return (
      <button onClick={() => set('in_progress', 'Job reopened')} disabled={isPending} className={OUTLINE}>
        {isPending ? 'Saving...' : 'Reopen'}
      </button>
    )
  }
  if (status === 'on_hold') {
    return (
      <button onClick={() => set('in_progress', 'Job resumed')} disabled={isPending} className={PRIMARY}>
        {isPending ? 'Saving...' : 'Resume'}
      </button>
    )
  }
  return (
    <>
      <button onClick={() => set('on_hold', 'Job put on hold')} disabled={isPending} className={OUTLINE}>
        Put on hold
      </button>
      <button onClick={() => set('complete', 'Job marked complete')} disabled={isPending} className={PRIMARY}>
        {isPending ? 'Saving...' : 'Mark complete'}
      </button>
    </>
  )
}

/** Inline "Mark job complete" link, used by the checklist once every task is ticked. */
export function MarkCompleteLink({ projectId }: { projectId: string }) {
  const { isPending, set } = useSetStatus(projectId)
  return (
    <button onClick={() => set('complete', 'Job marked complete')} disabled={isPending}
      className="font-medium text-[#715a3e] hover:underline disabled:opacity-50">
      {isPending ? 'Saving...' : 'Mark job complete'}
    </button>
  )
}
