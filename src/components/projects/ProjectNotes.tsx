'use client'
import { useState, useTransition } from 'react'
import { addNoteAction, deleteNoteAction } from '@/app/(dashboard)/projects/[id]/actions'
import type { ProjectNote } from '@/types'

interface Props { projectId: string; notes: ProjectNote[] }

export function ProjectNotes({ projectId, notes }: Props) {
  const [content, setContent] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    startTransition(async () => {
      await addNoteAction(projectId, content.trim())
      setContent('')
    })
  }

  function handleDelete(noteId: string) {
    if (!confirm('Delete this note?')) return
    startTransition(async () => { await deleteNoteAction(noteId, projectId) })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Progress Notes</h2>
      </div>
      <div className="p-6 space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Add a progress update..." rows={2}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={isPending || !content.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 self-end">
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
