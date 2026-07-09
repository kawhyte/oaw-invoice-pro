import { createClient } from '@/lib/supabase/server'
import { InvoiceList } from './InvoiceList'

const PAGE_SIZE = 25

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  const { page: pageParam, q: qParam, status: statusParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const status = statusParam ?? 'all'
  // Strip PostgREST or() syntax characters — q is interpolated into a filter string.
  const q = (qParam ?? '').trim().replace(/[,()%\\]/g, '')

  const supabase = await createClient()

  let query = supabase
    .from('invoices')
    .select(
      '*, projects(title, job_type, location_address, clients(name)), clients(name), invoice_line_items(section_title)',
      { count: 'exact' }
    )

  if (status !== 'all') query = query.eq('status', status)

  if (q) {
    // Search spans joined tables (client name, project location/title), which
    // PostgREST or() can't reach — resolve matching ids first, then filter.
    const [clientsRes, projectsRes] = await Promise.all([
      supabase.from('clients').select('id').ilike('name', `%${q}%`),
      supabase.from('projects').select('id').or(`location_address.ilike.%${q}%,title.ilike.%${q}%`),
    ])
    const clientIds = (clientsRes.data ?? []).map((c) => c.id)
    const projectIds = (projectsRes.data ?? []).map((p) => p.id)
    const ors = [`invoice_number.ilike.%${q}%`]
    if (clientIds.length > 0) ors.push(`client_id.in.(${clientIds.join(',')})`)
    if (projectIds.length > 0) ors.push(`project_id.in.(${projectIds.join(',')})`)
    query = query.or(ors.join(','))
  }

  const from = (page - 1) * PAGE_SIZE
  const { data: invoices, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Invoices</h1>
      </div>
      <InvoiceList
        invoices={(invoices ?? []) as any}
        totalCount={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        initialQuery={qParam ?? ''}
        status={status}
      />
    </div>
  )
}
