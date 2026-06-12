import { createClient } from '@/lib/supabase/server'
import { InvoiceList } from './InvoiceList'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, projects(title, job_type, location_address, clients(name))')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
      </div>
      <InvoiceList invoices={(invoices ?? []) as any} />
    </div>
  )
}
