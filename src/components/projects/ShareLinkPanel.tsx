'use client'
import { useState, useTransition } from 'react'
import { rotateShareTokenAction, toggleFinancialsAction } from '@/app/(dashboard)/projects/[id]/actions'

interface Props { projectId: string; shareToken: string; showFinancials: boolean }

export function ShareLinkPanel({ projectId, shareToken, showFinancials }: Props) {
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = `${origin}/share/${shareToken}`

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleRotate() {
    if (!confirm('Rotate share link? The old link will stop working immediately.')) return
    startTransition(async () => { await rotateShareTokenAction(projectId) })
  }

  function handleToggle() {
    startTransition(async () => { await toggleFinancialsAction(projectId, showFinancials) })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Client Share Link</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <input readOnly value={shareUrl}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 bg-gray-50 focus:outline-none" />
          <button onClick={handleCopy}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors shrink-0">
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={handleRotate} disabled={isPending}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
            {isPending ? 'Updating...' : 'Rotate link'}
          </button>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm text-gray-600">Show financials to client</span>
            <button type="button" role="switch" aria-checked={showFinancials} onClick={handleToggle} disabled={isPending}
              className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${showFinancials ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showFinancials ? 'translate-x-4' : ''}`} />
            </button>
          </label>
        </div>
      </div>
    </div>
  )
}
