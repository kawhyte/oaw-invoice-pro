'use client'
import { useState, useTransition } from 'react'
import { rotateShareTokenAction, toggleFinancialsAction } from '@/app/(dashboard)/projects/[id]/actions'

interface Props { projectId: string; shareToken: string; showFinancials: boolean; fileCount: number }

export function ShareLinkPanel({ projectId, shareToken, showFinancials, fileCount }: Props) {
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
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Client Share Link</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <input readOnly value={shareUrl}
            className="flex-1 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#5a5c62] bg-[#f8f9fa] focus:outline-none" />
          <button onClick={handleCopy}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors shrink-0">
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        {fileCount === 0 && (
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <svg
              className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-xs text-amber-700 leading-relaxed">
              No documents uploaded yet — your client will see an empty page if you share this link now.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button onClick={handleRotate} disabled={isPending}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
            {isPending ? 'Updating...' : 'Rotate link'}
          </button>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm text-gray-600">Show financials to client</span>
            <button type="button" role="switch" aria-checked={showFinancials} onClick={handleToggle} disabled={isPending}
              className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${showFinancials ? 'bg-[#715a3e]' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showFinancials ? 'translate-x-4' : ''}`} />
            </button>
          </label>
        </div>
      </div>
    </div>
  )
}
