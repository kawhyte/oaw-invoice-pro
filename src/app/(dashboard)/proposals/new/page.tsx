import { asc, eq } from 'drizzle-orm'
import { db, clients } from '@/db'
import { requireUserPage } from '@/lib/session'
import { ProposalForm } from '@/components/proposals/ProposalForm'

export default async function NewProposalPage() {
  const user = await requireUserPage()
  const clientRows = await db.select({ id: clients.id, name: clients.name, phone: clients.phone, email: clients.email, currency: clients.currency })
    .from(clients).where(eq(clients.user_id, user.id)).orderBy(asc(clients.name))

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">New Proposal</h1>
        <p className="text-sm text-[#8a8c94] mt-0.5">Only you see it until you tap Send.</p>
      </div>
      <ProposalForm clients={clientRows} />
    </div>
  )
}
