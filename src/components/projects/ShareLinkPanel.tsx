'use client'
import { useState, useTransition } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { rotateShareTokenAction, toggleFinancialsAction } from '@/app/(dashboard)/projects/[id]/actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface Props { projectId: string; shareToken: string; showFinancials: boolean; fileCount: number; noteCount: number; invoiceCount: number }

export function ShareLinkPanel({ projectId, shareToken, showFinancials, fileCount, noteCount, invoiceCount }: Props) {
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = `${origin}/share/${shareToken}`

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRotate() {
    if (!(await confirm({ title: 'Rotate share link?', description: 'The old link will stop working immediately.', confirmLabel: 'Rotate link' }))) return
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
        <div className="rounded-lg border border-[#e0e0e3] bg-[#f8f9fa] divide-y divide-[#e0e0e3]">
          <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">What your client will see</p>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-sm text-gray-700">Project documents</span>
            </div>
            {fileCount > 0
              ? <span className="text-sm text-gray-600">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
              : <span className="text-sm text-amber-600 font-medium">⚠ No files uploaded</span>}
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-sm text-gray-700">Progress notes</span>
            </div>
            {noteCount > 0
              ? <span className="text-sm text-gray-600">{noteCount} update{noteCount !== 1 ? 's' : ''}</span>
              : <span className="text-sm text-gray-400">No updates yet</span>}
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              {showFinancials
                ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                : <Circle className="w-4 h-4 text-gray-300 shrink-0" />}
              <span className="text-sm text-gray-700">Invoice summary</span>
            </div>
            {showFinancials
              ? <span className="text-sm text-gray-600">{invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''}</span>
              : <span className="text-sm text-gray-400">Off — toggle below to enable</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input readOnly value={shareUrl}
            className="flex-1 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#5a5c62] bg-[#f8f9fa] focus:outline-none" />
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
              className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${showFinancials ? 'bg-[#715a3e]' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showFinancials ? 'translate-x-4' : ''}`} />
            </button>
          </label>
        </div>
      </div>
    </div>
  )
}
