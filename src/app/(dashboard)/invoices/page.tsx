import { createClient } from '@/lib/supabase/server'
import { InvoiceList } from './InvoiceList'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, projects(title, clients(name))')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-gray-500 text-sm mt-0.5">{invoices?.length ?? 0} invoices</p>
      </div>
      <InvoiceList invoices={(invoices ?? []) as any} />
    </div>
  )
}
