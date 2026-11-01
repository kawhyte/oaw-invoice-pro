'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setProjectStatusAction } from '@/app/(dashboard)/projects/actions'
import { useToast, toErrorMessage } from '@/components/ui/Toast'
import type { ProjectStatus } from '@/types'

interface Props { projectId: string; status: ProjectStatus; variant?: 'button' | 'link' }

/**
 * One-tap "Mark job complete" (drops the project off the Workload card), or
 * "Reopen" for a completed job, which puts it back to In Progress.
 */
export function MarkCompleteButton({ projectId, status, variant = 'button' }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const toast = useToast()
  const complete = status === 'complete'

  function handleClick() {
    startTransition(async () => {
      try {
        await setProjectStatusAction(projectId, complete ? 'in_progress' : 'complete')
        router.refresh()
        toast.success(complete ? 'Job reopened' : 'Job marked complete')
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  if (variant === 'link') {
    return (
      <button onClick={handleClick} disabled={isPending}
        className="font-medium text-[#715a3e] hover:underline disabled:opacity-50">
        {isPending ? 'Saving...' : 'Mark job complete'}
      </button>
    )
  }

  return (
    <button onClick={handleClick} disabled={isPending}
      className={complete
        ? 'px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50'
        : 'px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors disabled:opacity-50'}>
      {isPending ? 'Saving...' : complete ? 'Reopen' : 'Mark complete'}
    </button>
  )
}
