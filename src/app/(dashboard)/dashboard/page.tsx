import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { FinancialChart } from '@/components/dashboard/FinancialChart'
import { ProjectMap } from '@/components/dashboard/ProjectMap'
import { RecentInvoices } from '@/components/dashboard/RecentInvoices'
import { RecentProjects } from '@/components/dashboard/RecentProjects'
import { OverdueAlert } from '@/components/dashboard/OverdueAlert'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: invoices }, { data: projects }, { data: recentInvoices }] = await Promise.all([
    supabase.from('invoices').select('*'),
    supabase.from('projects').select('*, clients(name)').order('updated_at', { ascending: false }),
    supabase
      .from('invoices')
      .select('*, projects(title, clients(name)), clients(name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Compute stats grouped by currency
  const statsMap: Record<string, { total: number; paid: number; owing: number }> = {}
  for (const inv of invoices ?? []) {
    if (!statsMap[inv.currency]) statsMap[inv.currency] = { total: 0, paid: 0, owing: 0 }
    statsMap[inv.currency].total += inv.total
    statsMap[inv.currency].paid += inv.amount_paid
    statsMap[inv.currency].owing += inv.total - inv.amount_paid
  }
  const stats = Object.entries(statsMap).map(([currency, v]) => ({ currency, ...v }))

  // Overdue = past the due date with a remaining balance. Computed from due_date
  // rather than stored status so it catches invoices that lapsed without re-saving.
  const today = new Date().toISOString().split('T')[0]
  const overdueInvoices = (invoices ?? []).filter(
    (i) => i.due_date && i.due_date < today && Number(i.total) - Number(i.amount_paid) > 0
  )
  const overdueOwingMap: Record<string, number> = {}
  for (const inv of overdueInvoices) {
    overdueOwingMap[inv.currency] = (overdueOwingMap[inv.currency] ?? 0) + (Number(inv.total) - Number(inv.amount_paid))
  }
  const overdueOwingByCurrency = Object.entries(overdueOwingMap).map(([currency, owing]) => ({ currency, owing }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Overview of your projects and billing</p>
      </div>

      <OverdueAlert count={overdueInvoices.length} owingByCurrency={overdueOwingByCurrency} />

      <StatsCards stats={stats} invoiceCount={invoices?.length ?? 0} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Financial Breakdown</h2>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="inline-block w-2 h-2 rounded-full bg-[#715a3e]" />
                Owing
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="inline-block w-2 h-2 rounded-full bg-[#e0e0e3] ring-1 ring-gray-300" />
                Paid
              </span>
            </div>
          </div>
          <div className="p-4">
            <FinancialChart stats={stats} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden isolate">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Project Locations</h2>
          </div>
          <ProjectMap projects={(projects ?? []) as any} />
        </div>
      </div>

      <RecentProjects projects={(projects ?? []).slice(0, 5) as any} />
      <RecentInvoices invoices={(recentInvoices ?? []) as any} />
    </div>
  )
}
