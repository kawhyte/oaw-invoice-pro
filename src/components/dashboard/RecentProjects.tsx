import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'

interface ProjectRow {
  id: string
  title: string
  status: string
  created_at: string
  clients: { name: string } | null
}

export function RecentProjects({ projects }: { projects: ProjectRow[] }) {
  return (
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-[#1a1c1e]">Recent Projects</h2>
        <Link href="/projects" className="text-sm text-[#715a3e] hover:text-[#8b7355] font-medium">View all →</Link>
      </div>
      {projects.length === 0 ? (
        <div className="px-6 py-8 text-center text-gray-400 text-sm">No projects yet.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {projects.map(project => (
            <Link key={project.id} href={`/projects/${project.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[#f8f9fa] transition-colors">
              <div>
                <p className="text-sm font-medium text-[#1a1c1e]">{project.title}</p>
                <p className="text-xs text-[#8a8c94] mt-0.5">
                  {project.clients?.name ?? '—'} · {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <StatusChip status={project.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
