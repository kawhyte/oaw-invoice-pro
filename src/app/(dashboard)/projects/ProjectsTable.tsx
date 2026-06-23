'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProjectDialog } from '@/components/projects/ProjectDialog'
import { StatusChip } from '@/components/ui/StatusChip'
import type { Client, Project } from '@/types'

interface Props { projects: Project[]; clients: Client[] }

type Tab = 'client' | 'personal'

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function ProjectsTable({ projects, clients }: Props) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [tab, setTab] = useState<Tab>('client')

  const clientProjects = projects.filter(p => !p.is_personal)
  const personalProjects = projects.filter(p => p.is_personal)
  const isPersonal = tab === 'personal'
  const visible = isPersonal ? personalProjects : clientProjects

  return (
    <>
      {/* Tabs: Client vs Personal */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-white border border-[#e0e0e3] rounded-xl shadow-card mb-4 max-w-md">
        <button onClick={() => setTab('client')}
          className={`py-2 text-sm font-medium rounded-lg transition-colors ${!isPersonal ? 'bg-[#715a3e] text-white' : 'text-[#5a5c62] hover:bg-[#f8f9fa]'}`}>
          Client Projects
          <span className={`ml-1.5 text-xs ${!isPersonal ? 'text-white/70' : 'text-[#8a8c94]'}`}>{clientProjects.length}</span>
        </button>
        <button onClick={() => setTab('personal')}
          className={`py-2 text-sm font-medium rounded-lg transition-colors ${isPersonal ? 'bg-[#715a3e] text-white' : 'text-[#5a5c62] hover:bg-[#f8f9fa]'}`}>
          Personal
          <span className={`ml-1.5 text-xs ${isPersonal ? 'text-white/70' : 'text-[#8a8c94]'}`}>{personalProjects.length}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <span className="text-sm font-medium text-[#1a1c1e]">
            {isPersonal ? 'Personal Projects' : 'Client Projects'}
          </span>
          <button onClick={() => setShowNew(true)} className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors">
            + New Project
          </button>
        </div>
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            {isPersonal ? 'No personal projects yet.' : 'No client projects yet.'}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="block lg:hidden space-y-3 p-4">
              {visible.map(project => (
                <Link key={project.id} href={`/projects/${project.id}`}
                  className="block bg-white rounded-xl border border-[#e0e0e3] shadow-[0px_4px_20px_rgba(26,28,30,0.04)] p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1a1c1e] truncate">{project.title}</p>
                      {isPersonal ? (
                        <p className="text-sm text-[#5a5c62]">
                          {project.budget != null ? `Budget ${formatMoney(Number(project.budget))}` : (project.job_type ?? '—')}
                        </p>
                      ) : (
                        <p className="text-sm text-[#5a5c62] truncate">{project.clients?.name ?? '—'}</p>
                      )}
                    </div>
                    <StatusChip status={project.status} />
                  </div>
                  {project.location_address && (
                    <div className="flex items-center gap-1 mt-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: project.lat ? '#715a3e' : '#d1d5db' }}
                        title={project.lat ? 'Shown on map' : 'Not geocoded — not on map'}
                      />
                      <p className="text-xs text-[#8a8c94] truncate">{project.location_address}</p>
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#f8f9fa]">
                  <tr>
                    <th className="px-6 py-3 text-left label-caps">Project</th>
                    <th className="px-6 py-3 text-left label-caps">{isPersonal ? 'Budget' : 'Client'}</th>
                    <th className="px-6 py-3 text-left label-caps">Status</th>
                    <th className="px-6 py-3 text-left label-caps">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map(p => (
                    <tr key={p.id} onClick={() => router.push(`/projects/${p.id}`)} className="hover:bg-[#f8f9fa] cursor-pointer transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-[#1a1c1e]">{p.title}</td>
                      <td className="px-6 py-4 text-sm text-[#5a5c62]">
                        {isPersonal
                          ? (p.budget != null ? formatMoney(Number(p.budget)) : '—')
                          : (p.clients?.name ?? '—')}
                      </td>
                      <td className="px-6 py-4">
                        <StatusChip status={p.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-[#8a8c94]">
                        {p.location_address ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: p.lat ? '#715a3e' : '#d1d5db' }}
                              title={p.lat ? 'Shown on map' : 'Not geocoded — not on map'}
                            />
                            {p.location_address}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {showNew && <ProjectDialog clients={clients} onClose={() => setShowNew(false)} defaultIsPersonal={isPersonal} />}
    </>
  )
}
