'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectDialog } from '@/components/projects/ProjectDialog'
import type { Client, Project, ProjectStatus } from '@/types'

const STATUS_STYLES: Record<ProjectStatus, string> = {
  discovery: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-700',
  complete: 'bg-green-100 text-green-700',
}
const STATUS_LABELS: Record<ProjectStatus, string> = {
  discovery: 'Discovery',
  in_progress: 'In Progress',
  review: 'Review',
  complete: 'Complete',
}

interface Props { projects: Project[]; clients: Client[] }

export function ProjectsTable({ projects, clients }: Props) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">All Projects</span>
          <button onClick={() => setShowNew(true)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            + New Project
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">No projects yet.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map(p => (
                <tr key={p.id} onClick={() => router.push(`/projects/${p.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.clients?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{p.location_address ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showNew && <ProjectDialog clients={clients} onClose={() => setShowNew(false)} />}
    </>
  )
}
