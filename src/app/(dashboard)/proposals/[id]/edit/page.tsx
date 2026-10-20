import { and, asc, eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { db, clients, proposals, proposal_line_items } from '@/db'
import { requireUserPage } from '@/lib/session'
import { effectiveStatus, isEditable } from '@/lib/proposals'
import { ProposalForm } from '@/components/proposals/ProposalForm'

export default async function EditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUserPage()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [proposal, clientRows] = await Promise.all([
    db.query.proposals.findFirst({
      where: and(eq(proposals.id, id), eq(proposals.user_id, user.id)),
      with: { proposal_line_items: { orderBy: proposal_line_items.sort_order } },
    }),
    db.select({ id: clients.id, name: clients.name, phone: clients.phone, email: clients.email, currency: clients.currency })
      .from(clients).where(eq(clients.user_id, user.id)).orderBy(asc(clients.name)),
  ])
  if (!proposal) notFound()
  if (!isEditable(effectiveStatus(proposal))) redirect(`/proposals/${id}`)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Edit {proposal.proposal_number}</h1>
        {proposal.status !== 'draft' && (
          <p className="text-sm text-[#8a8c94] mt-0.5">Your client keeps seeing the last sent version until you tap Send again.</p>
        )}
      </div>
      <ProposalForm clients={clientRows} proposal={proposal} />
    </div>
  )
}
