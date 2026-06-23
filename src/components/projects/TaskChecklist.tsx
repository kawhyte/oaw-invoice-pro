'use client'
import { useState, useTransition } from 'react'
import { CalendarDays } from 'lucide-react'
import { addTaskAction, toggleTaskAction, deleteTaskAction } from '@/app/(dashboard)/projects/[id]/actions'
import type { ProjectTask } from '@/types'

interface Props { projectId: string; tasks: ProjectTask[] }

function formatCost(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function formatDue(d: string) {
  // due_date is a plain date (no time) — parse as local to avoid TZ drift.
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function TaskChecklist({ projectId, tasks }: Props) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [cost, setCost] = useState('')
  const [isPending, startTransition] = useTransition()

  // Open tasks first (by sort order), completed sink to the bottom.
  const ordered = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return a.sort_order - b.sort_order
  })

  const doneCount = tasks.filter(t => t.completed).length

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      await addTaskAction(projectId, {
        title: title.trim(),
        cost: cost ? Number(cost) : null,
        due_date: dueDate || null,
      })
      setTitle('')
      setDueDate('')
      setCost('')
    })
  }

  function handleToggle(task: ProjectTask) {
    startTransition(async () => { await toggleTaskAction(projectId, task.id, !task.completed) })
  }

  function handleDelete(taskId: string) {
    if (!confirm('Delete this item?')) return
    startTransition(async () => { await deleteTaskAction(projectId, taskId) })
  }

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <h2 className="label-caps">Checklist</h2>
        {tasks.length > 0 && (
          <span className="text-xs text-[#8a8c94]">{doneCount} of {tasks.length} done</span>
        )}
      </div>
      <div className="p-6 space-y-4">
        <form onSubmit={handleAdd} className="space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Add a task…"
            className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white placeholder:text-[#8a8c94] focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="flex-1 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
            <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="Cost (optional)"
              className="flex-1 px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white placeholder:text-[#8a8c94] data-mono focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
            <button type="submit" disabled={isPending || !title.trim()}
              className="px-4 py-2 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50 whitespace-nowrap">
              Add
            </button>
          </div>
        </form>

        {ordered.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks yet.</p>
        ) : (
          <ul className="divide-y divide-[#f0f0f2]">
            {ordered.map(task => (
              <li key={task.id} className="flex items-start gap-3 py-3">
                <button type="button" onClick={() => handleToggle(task)} disabled={isPending}
                  aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${task.completed ? 'bg-[#715a3e] border-[#715a3e] text-white' : 'border-[#cfcfd4] hover:border-[#715a3e]'}`}>
                  {task.completed && (
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${task.completed ? 'line-through text-[#8a8c94]' : 'text-[#1a1c1e]'}`}>{task.title}</p>
                  {(task.due_date || task.cost != null) && (
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-[#8a8c94]">
                      {task.due_date && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDue(task.due_date)}
                        </span>
                      )}
                      {task.cost != null && <span className="data-mono">{formatCost(Number(task.cost))}</span>}
                    </div>
                  )}
                </div>
                <button onClick={() => handleDelete(task.id)} disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0 disabled:opacity-50">Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
