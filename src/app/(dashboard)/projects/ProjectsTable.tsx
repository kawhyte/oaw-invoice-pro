'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectDialog } from '@/components/projects/ProjectDialog'
import { StatusChip } from '@/components/ui/StatusChip'
import type { Client, Project } from '@/types'

interface Props { projects: Project[]; clients: Client[] }

export function ProjectsTable({ projects, clients }: Props) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)

  return (
    <>
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-[#1a1c1e]">All Projects</span>
          <button onClick={() => setShowNew(true)} className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors">
            + New Project
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">No projects yet.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-[#f8f9fa]">
              <tr>
                <th className="px-6 py-3 text-left label-caps">Project</th>
                <th className="px-6 py-3 text-left label-caps">Client</th>
                <th className="px-6 py-3 text-left label-caps">Status</th>
                <th className="px-6 py-3 text-left label-caps">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map(p => (
                <tr key={p.id} onClick={() => router.push(`/projects/${p.id}`)} className="hover:bg-[#f8f9fa] cursor-pointer transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-[#1a1c1e]">{p.title}</td>
                  <td className="px-6 py-4 text-sm text-[#5a5c62]">{p.clients?.name ?? '—'}</td>
                  <td className="px-6 py-4">
                    <StatusChip status={p.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-[#8a8c94]">{p.location_address ?? '—'}</td>
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
