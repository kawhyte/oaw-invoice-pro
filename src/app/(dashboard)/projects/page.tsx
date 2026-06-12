import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from './ProjectsTable'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const [{ data: projects }, { data: clients }] = await Promise.all([
    supabase.from('projects').select('*, clients(*)').order('created_at', { ascending: false }),
    supabase.from('clients').select('*').order('name'),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Projects</h1>
          <p className="text-gray-500 text-sm mt-0.5">{projects?.length ?? 0} projects</p>
        </div>
      </div>
      <ProjectsTable projects={projects ?? []} clients={clients ?? []} />
    </div>
  )
}
