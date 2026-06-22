import { createClient } from '@/lib/supabase/server'
import { InvoiceList } from './InvoiceList'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, projects(title, job_type, location_address, clients(name)), clients(name), invoice_line_items(section_title)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Invoices</h1>
      </div>
      <InvoiceList invoices={(invoices ?? []) as any} />
    </div>
  )
}
