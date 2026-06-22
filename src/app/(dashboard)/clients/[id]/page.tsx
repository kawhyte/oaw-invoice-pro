import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusChip } from '@/components/ui/StatusChip'
import { EditClientButton } from '@/components/clients/EditClientButton'
import type { Client } from '@/types'

const fmtMoney = (n: number, currency: string) =>
  `${currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!client) notFound()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, status, location_address')
    .eq('user_id', user.id)
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  const projectIds = (projects ?? []).map(p => p.id)

  // Invoices for this client: single-project ones (by project_id) + combined ones (by client_id).
  const orFilter = projectIds.length
    ? `client_id.eq.${id},project_id.in.(${projectIds.join(',')})`
    : `client_id.eq.${id}`
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, total, amount_paid, currency, created_at, project_id, invoice_line_items(section_title)')
    .eq('user_id', user.id)
    .or(orFilter)
    .order('created_at', { ascending: false })

  const c = client as Client
  const contactBits = [c.company, c.email, c.phone, c.country].filter(Boolean) as string[]
  const canCombine = (projects?.length ?? 0) >= 2

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/clients" className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">← Clients</Link>
          <div className="flex items-center gap-2 mt-2">
            <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">{c.name}</h1>
            {c.currency && (
              <span className="text-xs font-mono bg-[#f8f9fa] border border-[#e0e0e3] px-2 py-0.5 rounded-full text-[#5a5c62]">
                {c.currency}
              </span>
            )}
          </div>
          {contactBits.length > 0 && (
            <p className="text-sm text-[#5a5c62] mt-0.5">{contactBits.join(' · ')}</p>
          )}
        </div>
        <EditClientButton client={c} />
      </div>

      {c.address && (
        <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-6">
          <p className="label-caps mb-1">Address</p>
          <p className="text-sm text-[#5a5c62]">{c.address}</p>
        </div>
      )}

      {/* Projects */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0e0e3]">
          <h2 className="label-caps">Projects</h2>
          <Link href="/projects" className="text-sm font-medium text-[#715a3e] hover:text-[#8b7355] transition-colors">
            + New Project
          </Link>
        </div>
        <div className="p-6">
          {(!projects || projects.length === 0) ? (
            <p className="text-sm text-[#8a8c94]">No projects yet for this client.</p>
          ) : (
            <div className="divide-y divide-[#f0f0f2]">
              {projects.map(p => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between py-3 hover:bg-[#f8f9fa] -mx-6 px-6 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-[#1a1c1e] truncate">{p.title}</span>
                    <StatusChip status={p.status} />
                  </div>
                  {p.location_address && (
                    <span className="text-xs text-[#8a8c94] truncate hidden sm:block">{p.location_address}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0e0e3]">
          <h2 className="label-caps">Invoices</h2>
          {canCombine && (
            <Link
              href={`/invoices/combined/new?clientId=${id}`}
              className="text-sm font-medium text-[#715a3e] hover:text-[#8b7355] transition-colors"
            >
              + Combined Invoice
            </Link>
          )}
        </div>
        <div className="p-6">
          {(!invoices || invoices.length === 0) ? (
            <p className="text-sm text-[#8a8c94]">No invoices yet for this client.</p>
          ) : (
            <div className="divide-y divide-[#f0f0f2]">
              {invoices.map((inv: { id: string; invoice_number: string; status: string; total: number; amount_paid: number; currency: string; project_id: string | null; invoice_line_items: { section_title: string | null }[] }) => {
                const owing = Number(inv.total) - Number(inv.amount_paid)
                const combinedProjects = inv.project_id === null
                  ? [...new Set((inv.invoice_line_items ?? []).map(li => li.section_title).filter(Boolean))] as string[]
                  : []
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between py-3 hover:bg-[#f8f9fa] -mx-6 px-6 transition-colors gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-medium text-[#1a1c1e]">{inv.invoice_number}</span>
                        <StatusChip status={inv.status} />
                        {inv.project_id === null && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5ede4] border border-[#715a3e]/20 text-[#715a3e] font-medium">Combined</span>
                        )}
                      </div>
                      {combinedProjects.length > 0 && (
                        <p className="text-xs text-[#8a8c94] mt-0.5 truncate">{combinedProjects.join(' + ')}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm text-[#1a1c1e]">{fmtMoney(inv.total, inv.currency)}</p>
                      {owing > 0 && (
                        <p className="font-mono text-xs text-[#715a3e]">{fmtMoney(owing, inv.currency)} owing</p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
