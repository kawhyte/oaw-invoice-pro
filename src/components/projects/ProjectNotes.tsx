'use client'
import { useState, useTransition } from 'react'
import { addNoteAction, deleteNoteAction } from '@/app/(dashboard)/projects/[id]/actions'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast, toErrorMessage } from '@/components/ui/Toast'
import { VisibilityBadge } from '@/components/ui/VisibilityBadge'
import type { ProjectNote } from '@/types'

interface Props { projectId: string; notes: ProjectNote[]; showClientBadge?: boolean }

export function ProjectNotes({ projectId, notes, showClientBadge = true }: Props) {
  const [content, setContent] = useState('')
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()
  const toast = useToast()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    startTransition(async () => {
      try {
        await addNoteAction(projectId, content.trim())
        setContent('')
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  async function handleDelete(noteId: string) {
    if (!(await confirm({ title: 'Delete this note?', confirmLabel: 'Delete', variant: 'danger' }))) return
    startTransition(async () => {
      try {
        await deleteNoteAction(noteId, projectId)
      } catch (err) {
        toast.error(toErrorMessage(err))
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Progress Notes</h2>
        {showClientBadge && <VisibilityBadge variant="shared" />}
      </div>
      <div className="p-6 space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Add a progress update..." rows={2}
            className="flex-1 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white placeholder:text-[#8a8c94] resize-none focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
          <button type="submit" disabled={isPending || !content.trim()}
            className="px-4 py-2 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50 self-end">
            Add
          </button>
        </form>
        {notes.length === 0 ? (
          <p className="text-sm text-gray-400">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map(note => (
              <div key={note.id} className="flex items-start justify-between gap-4 py-3 border-t border-gray-50">
                <div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => handleDelete(note.id)} disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0 disabled:opacity-50">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
