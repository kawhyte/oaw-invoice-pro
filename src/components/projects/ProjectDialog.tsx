'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createProjectAction, updateProjectAction, deleteProjectAction } from '@/app/(dashboard)/projects/actions'
import type { Client, Project } from '@/types'
import { JOB_TYPES } from '@/types'

const STATUS_OPTIONS = [
  { value: 'discovery', label: 'Discovery' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'complete', label: 'Complete' },
]

interface Props {
  project?: Project
  clients: Client[]
  onClose: () => void
}

export function ProjectDialog({ project, clients, onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [clientId, setClientId] = useState(project?.client_id ?? '')
  const [status, setStatus] = useState(project?.status ?? 'discovery')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      if (project) await updateProjectAction(project.id, formData)
      else await createProjectAction(formData)
      onClose()
      router.refresh()
    })
  }

  function handleDelete() {
    if (!project) return
    if (!confirm('Delete this project? This cannot be undone.')) return
    startTransition(async () => {
      await deleteProjectAction(project.id)
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900">{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Title *</label>
            <input name="title" required defaultValue={project?.title} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Client *</label>
            <select name="client_id" required value={clientId} onChange={e => setClientId(e.target.value)}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${clientId === '' ? 'text-gray-400' : 'text-gray-900'}`}>
              <option value="">Select a client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Status</label>
            <select name="status" value={status} onChange={e => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
            <select name="job_type" defaultValue={project?.job_type ?? ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Select type —</option>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Description</label>
            <textarea name="description" rows={3} defaultValue={project?.description ?? ''} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Location Address</label>
            <input name="location_address" defaultValue={project?.location_address ?? ''} placeholder="e.g. 10 Harbour St, Kingston, Jamaica" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Address will be geocoded automatically for the map.</p>
          </div>
          <div className="flex items-center justify-between pt-2">
            {project ? (
              <button type="button" onClick={handleDelete} disabled={isPending} className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
            ) : <div />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
