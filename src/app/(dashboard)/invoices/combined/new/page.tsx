import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { CombinedInvoiceForm } from '@/components/invoices/CombinedInvoiceForm'
import type { BusinessSettings } from '@/types'

interface RawLineItem { description: string; quantity: number; unit_price: number; sort_order: number }
interface RawInvoice {
  id: string
  project_id: string | null
  invoice_number: string
  status: string
  amount_paid: number
  currency: string
  invoice_line_items: RawLineItem[]
}

export default async function NewCombinedInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const { clientId } = await searchParams
  if (!clientId) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, currency')
    .eq('id', clientId)
    .eq('user_id', user.id)
    .single()
  if (!client) notFound()

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title')
    .eq('user_id', user.id)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (!projects || projects.length < 2) {
    // Combining needs at least two projects — send the user back to the client.
    redirect(`/clients/${clientId}`)
  }

  const projectIds = projects.map(p => p.id)
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, project_id, invoice_number, status, amount_paid, currency, invoice_line_items(description, quantity, unit_price, sort_order)')
    .eq('user_id', user.id)
    .in('project_id', projectIds)

  const { data: bizSettings } = await supabase
    .from('business_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Group each project's draft (absorbable) and already-billed (informational) invoices.
  const byProject = (invoices ?? []) as RawInvoice[]
  const projectData = projects.map(p => {
    const own = byProject.filter(inv => inv.project_id === p.id)
    const draft = own.find(inv => inv.status === 'draft')
    const billed = own
      .filter(inv => inv.status !== 'draft')
      .map(inv => ({ invoice_number: inv.invoice_number, status: inv.status }))
    return {
      id: p.id,
      title: p.title,
      draftInvoice: draft
        ? {
            id: draft.id,
            invoice_number: draft.invoice_number,
            amount_paid: Number(draft.amount_paid) || 0,
            items: [...draft.invoice_line_items]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(i => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
          }
        : null,
      billed,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/clients/${clientId}`} className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">← {client.name}</Link>
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e] mt-2">Combined Invoice</h1>
        <p className="text-sm text-[#5a5c62] mt-0.5">Bill several of {client.name}&apos;s projects on one invoice.</p>
      </div>
      <CombinedInvoiceForm
        client={{ id: client.id, name: client.name, currency: (client.currency as 'JMD' | 'USD' | null) }}
        projects={projectData}
        bizSettings={(bizSettings as BusinessSettings) ?? null}
      />
    </div>
  )
}
