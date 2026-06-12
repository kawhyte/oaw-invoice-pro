import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InvoiceForm } from '@/components/invoices/InvoiceForm'

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: projects }, { data: bizSettings }] = await Promise.all([
    supabase.from('projects').select('*, clients(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('business_settings').select('*').eq('user_id', user.id).single(),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
      </div>
      <InvoiceForm projects={(projects ?? []) as any} bizSettings={bizSettings} />
    </div>
  )
}
