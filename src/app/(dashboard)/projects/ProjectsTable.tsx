'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { ProjectDialog } from '@/components/projects/ProjectDialog'
import { StatusChip } from '@/components/ui/StatusChip'
import type { Client, Project } from '@/types'

interface Props { projects: Project[]; clients: Client[] }

type Tab = 'client' | 'personal'
// Finished and paused jobs are kept (never deleted) but live outside the
// default Active list; search always looks across all of them.
type View = 'active' | 'on_hold' | 'completed'

const VIEWS: { value: View; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
]

function viewOf(p: Project): View {
  return p.status === 'complete' ? 'completed' : p.status === 'on_hold' ? 'on_hold' : 'active'
}

function matches(p: Project, q: string) {
  return [p.title, p.clients?.name, p.location_address, p.job_type, p.description]
    .some(v => v?.toLowerCase().includes(q))
}

function formatMoney(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function ProjectsTable({ projects, clients }: Props) {
  const router = useRouter()
  const [showNew, setShowNew] = useState(false)
  const [tab, setTab] = useState<Tab>('client')
  const [view, setView] = useState<View>('active')
  const [query, setQuery] = useState('')

  const clientProjects = projects.filter(p => !p.is_personal)
  const personalProjects = projects.filter(p => p.is_personal)
  const isPersonal = tab === 'personal'
  const inTab = isPersonal ? personalProjects : clientProjects
  const q = query.trim().toLowerCase()
  const searching = q !== ''
  // Search spans both tabs and every status, so an old job is always findable.
  const visible = searching ? projects.filter(p => matches(p, q)) : inTab.filter(p => viewOf(p) === view)
  const kind = isPersonal ? 'personal' : 'client'
  const emptyText = searching
    ? `No projects match "${query.trim()}".`
    : view === 'active' ? `No active ${kind} projects.`
    : view === 'on_hold' ? `No ${kind} projects on hold.`
    : `No completed ${kind} projects yet.`

  return (
    <div className="overflow-x-hidden">
      {/* Tabs: Client vs Personal */}
      <div className="w-full grid grid-cols-2 gap-1 p-1 bg-white border border-[#e0e0e3] rounded-xl shadow-card mb-4 max-w-md">
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
            {searching ? `${visible.length} ${visible.length === 1 ? 'result' : 'results'}` : isPersonal ? 'Personal Projects' : 'Client Projects'}
          </span>
          <button onClick={() => setShowNew(true)} className="px-3 py-1.5 text-sm bg-[#715a3e] text-white rounded-lg hover:bg-[#8b7355] transition-colors">
            + New Project
          </button>
        </div>
        <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8a8c94] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search all projects, clients, addresses…" aria-label="Search projects"
              className="w-full pl-9 pr-3 py-2 border border-[#e0e0e3] rounded-lg text-sm text-[#1a1c1e] bg-white placeholder:text-[#8a8c94] focus:outline-none focus:ring-1 focus:ring-[#715a3e] focus:border-[#715a3e]" />
          </div>
          {!searching && (
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Project status">
              {VIEWS.map(v => {
                const count = inTab.filter(p => viewOf(p) === v.value).length
                const on = view === v.value
                return (
                  <button key={v.value} role="tab" aria-selected={on} onClick={() => setView(v.value)}
                    className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${on ? 'bg-[#f5ede4] text-[#715a3e] font-medium' : 'text-[#5a5c62] hover:bg-[#f8f9fa]'}`}>
                    {v.label} <span className={on ? 'text-[#715a3e]/70' : 'text-[#8a8c94]'}>{count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {visible.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            {emptyText}
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
                      {project.is_personal ? (
                        <p className="text-sm text-[#5a5c62] truncate">
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
                    <th className="px-6 py-3 text-left label-caps">{searching ? 'Client / Budget' : isPersonal ? 'Budget' : 'Client'}</th>
                    <th className="px-6 py-3 text-left label-caps">Status</th>
                    <th className="px-6 py-3 text-left label-caps">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map(p => (
                    <tr key={p.id} onClick={() => router.push(`/projects/${p.id}`)} className="hover:bg-[#f8f9fa] cursor-pointer transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-[#1a1c1e]">{p.title}</td>
                      <td className="px-6 py-4 text-sm text-[#5a5c62]">
                        {p.is_personal
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
    </div>
  )
}
