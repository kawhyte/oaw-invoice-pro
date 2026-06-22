import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, invoice_line_items(*), projects(*, clients(*))')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!invoice) redirect('/invoices')

  if (invoice.status === 'paid') redirect(`/invoices/${id}`)
  // Combined invoices (no single project) can't be edited in the standard form —
  // use "Separate" on the detail page to split them back into editable drafts.
  if (invoice.project_id === null) redirect(`/invoices/${id}`)

  const { data: bizSettings } = await supabase
    .from('business_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: projects } = await supabase
    .from('projects')
    .select('*, clients(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const project = (invoice as any).projects

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">
          Edit {invoice.invoice_number}
        </h1>
        <p className="text-sm text-[#5a5c62] mt-1">
          {project?.clients?.name}{project?.title ? ` · ${project.title}` : ''}
        </p>
      </div>
      <InvoiceForm
        projects={projects ?? []}
        bizSettings={bizSettings}
        invoice={invoice as any}
        editMode={true}
      />
    </div>
  )
}
