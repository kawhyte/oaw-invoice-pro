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
  /** Preselects the Personal tab when creating from the Personal projects tab. */
  defaultIsPersonal?: boolean
}

export function ProjectDialog({ project, clients, onClose, defaultIsPersonal = false }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [isPersonal, setIsPersonal] = useState(project?.is_personal ?? defaultIsPersonal)
  const [clientId, setClientId] = useState(project?.client_id ?? '')
  const [status, setStatus] = useState(project?.status ?? 'discovery')
  const [geocodeWarning, setGeocodeWarning] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = project
        ? await updateProjectAction(project.id, formData)
        : await createProjectAction(formData)
      router.refresh()
      if (!result.geocoded) {
        setGeocodeWarning(true)
        return
      }
      onClose()
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
      <div className="bg-white rounded-xl w-full max-w-lg shadow-card max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900">{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input type="hidden" name="is_personal" value={isPersonal ? 'true' : 'false'} />
          {/* Client vs Personal toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#f8f9fa] border border-[#e0e0e3] rounded-lg">
            <button type="button" onClick={() => setIsPersonal(false)}
              className={`py-1.5 text-sm font-medium rounded-md transition-colors ${!isPersonal ? 'bg-white text-[#1a1c1e] shadow-sm' : 'text-[#8a8c94] hover:text-[#5a5c62]'}`}>
              Client Project
            </button>
            <button type="button" onClick={() => setIsPersonal(true)}
              className={`py-1.5 text-sm font-medium rounded-md transition-colors ${isPersonal ? 'bg-white text-[#1a1c1e] shadow-sm' : 'text-[#8a8c94] hover:text-[#5a5c62]'}`}>
              Personal
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Title *</label>
            <input name="title" required defaultValue={project?.title} className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
          </div>
          {isPersonal ? (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Budget</label>
              <input name="budget" type="number" min="0" step="0.01" defaultValue={project?.budget ?? ''}
                placeholder="e.g. 500000"
                className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
              <p className="text-xs text-gray-400 mt-1">Optional. Spend rolls up from your checklist item costs.</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">Client *</label>
              <select name="client_id" required={!isPersonal} value={clientId} onChange={e => setClientId(e.target.value)}
                className={`select-field w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e] ${clientId === '' ? 'text-gray-400' : 'text-gray-900'}`}>
                <option value="">Select a client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Status</label>
            <select name="status" value={status} onChange={e => setStatus(e.target.value as any)}
              className="select-field w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]">
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
            <select name="job_type" defaultValue={project?.job_type ?? ''}
              className="select-field w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]">
              <option value="">— Select type —</option>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Description</label>
            <textarea name="description" rows={3} defaultValue={project?.description ?? ''} className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e] resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800 mb-1">Location Address</label>
            <input
              name="location_address"
              defaultValue={project?.location_address ?? ''}
              placeholder="e.g. 10 Harbour St, Kingston, Jamaica"
              onChange={() => setGeocodeWarning(false)}
              className="w-full px-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]"
            />
            {geocodeWarning ? (
              <p className="text-xs text-orange-500 mt-1">
                Address couldn&apos;t be geocoded — this project won&apos;t appear on the map. Try a broader address (e.g. city and parish).
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Address will be geocoded automatically for the map.</p>
            )}
          </div>
          <div className="flex items-center justify-between pt-2">
            {project ? (
              <button type="button" onClick={handleDelete} disabled={isPending} className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
            ) : <div />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] disabled:opacity-50">
                {isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
