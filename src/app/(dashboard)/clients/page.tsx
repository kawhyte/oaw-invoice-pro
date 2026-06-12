import { createClient } from '@/lib/supabase/server'
import { ClientsTable } from './ClientsTable'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('name')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{clients?.length ?? 0} clients</p>
        </div>
      </div>
      <ClientsTable clients={clients ?? []} />
    </div>
  )
}
