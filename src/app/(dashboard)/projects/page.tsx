import { asc, desc, eq } from 'drizzle-orm'
import { db, projects as projectsTable, clients as clientsTable, business_settings } from '@/db'
import { requireUserPage } from '@/lib/session'
import type { ComponentProps } from 'react'
import { ProjectsTable } from './ProjectsTable'
import { WorkloadCard } from '@/components/dashboard/WorkloadCard'
import { currentLoad, DEFAULT_MAX_WORKLOAD } from '@/lib/capacity'

export default async function ProjectsPage() {
  const user = await requireUserPage()
  const [projects, clients, settings] = await Promise.all([
    db.query.projects.findMany({
      where: eq(projectsTable.user_id, user.id),
      with: { clients: true },
      orderBy: desc(projectsTable.created_at),
    }),
    db.select().from(clientsTable).where(eq(clientsTable.user_id, user.id)).orderBy(asc(clientsTable.name)),
    db.query.business_settings.findFirst({ columns: { max_workload: true }, where: eq(business_settings.user_id, user.id) }),
  ])

  // Same calculation as the dashboard so both pages always agree.
  const load = currentLoad(projects)
  const maxWorkload = settings?.max_workload ?? DEFAULT_MAX_WORKLOAD

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Projects</h1>
          <p className="text-gray-500 text-sm mt-0.5">{projects.length} projects</p>
        </div>
      </div>
      <div className="mb-6">
        <WorkloadCard load={load} max={maxWorkload} />
      </div>
      <ProjectsTable
        projects={projects as unknown as ComponentProps<typeof ProjectsTable>['projects']}
        clients={clients as unknown as ComponentProps<typeof ProjectsTable>['clients']}
      />
    </div>
  )
}
