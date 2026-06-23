import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from './ProjectsTable'
import { WorkloadCard } from '@/components/dashboard/WorkloadCard'
import { currentLoad, DEFAULT_MAX_WORKLOAD } from '@/lib/capacity'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const [{ data: projects }, { data: clients }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*, clients(*)').order('created_at', { ascending: false }),
    supabase.from('clients').select('*').order('name'),
    supabase.from('business_settings').select('max_workload').maybeSingle(),
  ])

  // Same calculation as the dashboard so both pages always agree.
  const load = currentLoad(projects ?? [])
  const maxWorkload = settings?.max_workload ?? DEFAULT_MAX_WORKLOAD

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Projects</h1>
          <p className="text-gray-500 text-sm mt-0.5">{projects?.length ?? 0} projects</p>
        </div>
      </div>
      <div className="mb-6">
        <WorkloadCard load={load} max={maxWorkload} />
      </div>
      <ProjectsTable projects={projects ?? []} clients={clients ?? []} />
    </div>
  )
}
