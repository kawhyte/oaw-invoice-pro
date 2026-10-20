import { and, desc, eq, gte, ilike, inArray, isNotNull, lt, or, type SQL } from 'drizzle-orm'
import { db, proposals } from '@/db'
import { requireUserPage } from '@/lib/session'
import { todayInBusinessTz } from '@/lib/dates'
import { ProposalList } from './ProposalList'

const PAGE_SIZE = 25

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  const { page: pageParam, q: qParam, status: statusParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const status = statusParam ?? 'all'
  // LIKE wildcards in the user's text are matched literally.
  const q = (qParam ?? '').trim().replace(/[\\%_]/g, (c) => `\\${c}`)
  const user = await requireUserPage()
  const today = todayInBusinessTz()

  // 'expired' is derived from valid_until (never stored), so open/expired filter on the date too.
  const open = inArray(proposals.status, ['sent', 'revised'])
  const filters: SQL[] = [eq(proposals.user_id, user.id)]
  if (status === 'open') filters.push(open, gte(proposals.valid_until, today))
  else if (status === 'expired') filters.push(open, lt(proposals.valid_until, today))
  else if (status === 'changes') filters.push(open, isNotNull(proposals.changes_requested_at))
  else if (['draft', 'accepted', 'declined', 'converted'].includes(status)) {
    filters.push(eq(proposals.status, status as 'draft'))
  }
  if (q) {
    const pattern = `%${q}%`
    filters.push(or(
      ilike(proposals.proposal_number, pattern),
      ilike(proposals.title, pattern),
      ilike(proposals.recipient_name, pattern),
    )!)
  }
  const where = and(...filters)

  const [rows, count] = await Promise.all([
    db.select({
      id: proposals.id, proposal_number: proposals.proposal_number, title: proposals.title,
      recipient_name: proposals.recipient_name, currency: proposals.currency, total: proposals.total,
      status: proposals.status, valid_until: proposals.valid_until, changes_requested_at: proposals.changes_requested_at,
    }).from(proposals).where(where).orderBy(desc(proposals.updated_at)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.$count(proposals, where),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">Proposals</h1>
        <p className="text-gray-500 text-sm mt-0.5">Quotes for prospective work — convert to an invoice once accepted</p>
      </div>
      <ProposalList proposals={rows} totalCount={count} page={page} pageSize={PAGE_SIZE}
        initialQuery={qParam ?? ''} status={status} today={today} />
    </div>
  )
}
