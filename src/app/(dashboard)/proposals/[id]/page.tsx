import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  db, business_settings, invoices, projects, proposals, proposal_line_items, proposal_versions, proposal_responses, proposal_drawings,
} from '@/db'
import { requireUserPage } from '@/lib/session'
import { StatusChip } from '@/components/ui/StatusChip'
import { daysBetween, todayInBusinessTz } from '@/lib/dates'
import { buildSnapshot, effectiveStatus, formatMoney, groupByCategory, isEditable, snapshotsEqual } from '@/lib/proposals'
import { ProposalActions } from '@/components/proposals/ProposalActions'
import { VersionHistory } from '@/components/proposals/VersionHistory'
import { ProposalDrawingUpload } from '@/components/proposals/ProposalDrawingUpload'
import { ProposalDrawingList } from '@/components/proposals/ProposalDrawingList'

const longDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00Z` : d)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Jamaica' })

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUserPage()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const p = await db.query.proposals.findFirst({
    where: and(eq(proposals.id, id), eq(proposals.user_id, user.id)),
    with: { proposal_line_items: { orderBy: proposal_line_items.sort_order } },
  })
  if (!p) notFound()

  const [versions, responses, drawings, settings, invoice, project] = await Promise.all([
    db.select().from(proposal_versions).where(eq(proposal_versions.proposal_id, id)).orderBy(desc(proposal_versions.version)),
    db.select().from(proposal_responses).where(eq(proposal_responses.proposal_id, id)).orderBy(desc(proposal_responses.created_at)),
    db.select({ id: proposal_drawings.id, name: proposal_drawings.name, page_count: proposal_drawings.page_count })
      .from(proposal_drawings).where(eq(proposal_drawings.proposal_id, id)).orderBy(desc(proposal_drawings.created_at)),
    db.query.business_settings.findFirst({ columns: { business_name: true }, where: eq(business_settings.user_id, user.id) }),
    p.invoice_id
      ? db.select({ id: invoices.id, invoice_number: invoices.invoice_number }).from(invoices)
          .where(and(eq(invoices.id, p.invoice_id), eq(invoices.user_id, user.id))).limit(1).then(r => r[0] ?? null)
      : null,
    p.project_id
      ? db.select({ id: projects.id, title: projects.title }).from(projects)
          .where(and(eq(projects.id, p.project_id), eq(projects.user_id, user.id))).limit(1).then(r => r[0] ?? null)
      : null,
  ])

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const origin = `${h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https')}://${host}`

  const today = todayInBusinessTz()
  const status = effectiveStatus(p, today)
  const editable = isEditable(status)
  const latest = versions[0]
  const current = buildSnapshot(p, p.proposal_line_items)
  const unsentChanges = !!latest && editable && !snapshotsEqual(latest.snapshot, current)
  const accepted = p.accepted_version != null ? versions.find(v => v.version === p.accepted_version) : undefined
  // Show what the client agreed to once accepted; otherwise the working copy.
  const shown = accepted && !editable ? accepted.snapshot : current
  const fmt = (n: number) => formatMoney(n, shown.currency)
  const daysLeft = daysBetween(today, p.valid_until)
  const latestChangeRequest = p.changes_requested_at ? responses.find(r => r.kind === 'changes') : undefined
  const watermarkText = `PROPOSAL · ${settings?.business_name || 'OW Studio'} · NOT FOR CONSTRUCTION`

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="space-y-3">
        <Link href="/proposals" className="text-sm text-[#8a8c94] hover:text-[#5a5c62]">← Proposals</Link>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-serif text-2xl font-bold text-[#1a1c1e]">{p.proposal_number}</h1>
          <StatusChip status={status} />
          {p.changes_requested_at && (status === 'sent' || status === 'revised') && <StatusChip status="changes" />}
          {unsentChanges && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5ede4] border border-[#715a3e]/20 text-[#715a3e] font-medium">Unsent changes</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-medium text-[#1a1c1e] break-words">{shown.title}</p>
          <p className="text-sm text-[#5a5c62]">
            For{' '}
            {p.client_id
              ? <Link href={`/clients/${p.client_id}`} className="text-[#715a3e] hover:underline">{p.recipient_name}</Link>
              : <>{p.recipient_name} <span className="text-[#8a8c94]">(prospect)</span></>}
            {p.recipient_phone ? ` · ${p.recipient_phone}` : ''}
          </p>
          <p className={`text-sm mt-0.5 ${editable && daysLeft <= 7 ? 'text-amber-700' : 'text-[#8a8c94]'}`}>
            {status === 'expired' ? `Expired ${longDate(p.valid_until)}` : `Valid until ${longDate(p.valid_until)}`}
            {editable && status !== 'expired' ? ` · ${daysLeft === 0 ? 'last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}` : ''}
          </p>
        </div>
        <ProposalActions
          id={p.id} number={p.proposal_number} title={p.title} status={status} shareToken={p.share_token} origin={origin}
          hasVersion={!!latest} unsentChanges={unsentChanges} recipientName={p.recipient_name} recipientPhone={p.recipient_phone}
          isNewClient={!p.client_id} validUntil={p.valid_until} validUntilLabel={longDate(p.valid_until)} daysLeft={daysLeft}
          today={today} acceptedTotal={accepted ? formatMoney(accepted.total, accepted.snapshot.currency) : fmt(current.total)}
          drawingCount={drawings.length} invoiceNumber={invoice?.invoice_number ?? null}
        />
      </div>

      {latestChangeRequest && (status === 'sent' || status === 'revised') && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 sm:px-5 py-4">
          <p className="text-sm font-semibold text-amber-900">
            {latestChangeRequest.responder_name || p.recipient_name} asked for changes to version {latestChangeRequest.version}
          </p>
          {latestChangeRequest.note && <p className="text-sm text-amber-800 mt-1 whitespace-pre-wrap break-words">{latestChangeRequest.note}</p>}
          <p className="text-xs text-amber-700 mt-2">Edit the proposal, then tap “Send update” — they’ll see what changed.</p>
        </div>
      )}

      {status === 'accepted' && (
        <div className="rounded-xl border border-[#2a5130]/30 bg-[#dde8dd] px-4 sm:px-5 py-4">
          <p className="text-sm font-semibold text-[#2a5130]">
            Accepted {p.accepted_by_name ? `by ${p.accepted_by_name} ` : ''}{p.accepted_at ? `on ${longDate(p.accepted_at)}` : ''} (version {p.accepted_version})
          </p>
          <p className="text-xs text-[#2a5130] mt-1">Tap “Convert to invoice” to create the client, project and draft invoice.</p>
        </div>
      )}

      {status === 'converted' && (
        <div className="rounded-xl border border-[#715a3e]/20 bg-[#f5ede4] px-4 sm:px-5 py-4 text-sm text-[#584329] space-y-1">
          <p className="font-semibold">Converted {p.converted_at ? `on ${longDate(p.converted_at)}` : ''}</p>
          <p>
            {invoice ? <Link href={`/invoices/${invoice.id}`} className="text-[#715a3e] underline">{invoice.invoice_number}</Link> : 'Invoice deleted'}
            {' · '}
            {project ? <Link href={`/projects/${project.id}`} className="text-[#715a3e] underline">{project.title}</Link> : 'Project deleted'}
          </p>
          <p className="text-xs text-[#8a8c94]">
            {invoice
              ? 'Need to change it? “Undo conversion” puts it back to Accepted and removes the draft invoice.'
              : 'Its invoice is gone — you can undo the conversion to reuse this proposal, or delete it.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {shown.scope && (
            <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-4 sm:p-6">
              <h2 className="label-caps mb-2">Scope of work</h2>
              <p className="text-sm text-[#5a5c62] whitespace-pre-wrap break-words">{shown.scope}</p>
              {(shown.job_type || shown.location_address) && (
                <p className="text-xs text-[#8a8c94] mt-3">{[shown.job_type, shown.location_address].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100"><h2 className="label-caps">Pricing</h2></div>
            <div className="p-4 sm:p-6 space-y-5">
              {groupByCategory(shown.items).map(g => (
                <div key={g.label}>
                  <h3 className="text-xs font-semibold text-[#715a3e] uppercase tracking-wide mb-1">{g.label}</h3>
                  <div className="divide-y divide-gray-100">
                    {g.items.map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm text-[#1a1c1e] break-words">{item.description}</p>
                          <p className="text-xs text-[#8a8c94] data-mono">{item.quantity} × {fmt(item.unit_price)}</p>
                        </div>
                        <span className="text-sm data-mono text-[#1a1c1e] shrink-0">{fmt(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="border-t border-[#e0e0e3] pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-[#5a5c62]"><span>Subtotal</span><span className="data-mono">{fmt(shown.subtotal)}</span></div>
                {shown.discount_amount > 0 && <div className="flex justify-between text-[#5a5c62]"><span>Discount</span><span className="data-mono">- {fmt(shown.discount_amount)}</span></div>}
                {shown.gct_rate > 0 && <div className="flex justify-between text-[#5a5c62]"><span>GCT (15%)</span><span className="data-mono">{fmt(shown.gct_amount)}</span></div>}
                {shown.additions_amount > 0 && <div className="flex justify-between gap-3 text-[#5a5c62]"><span className="truncate">{shown.additions_description || 'Additions'}</span><span className="data-mono shrink-0">+ {fmt(shown.additions_amount)}</span></div>}
                <div className="flex justify-between font-bold text-[#1a1c1e] text-base pt-2 border-t border-[#e0e0e3]"><span>Total</span><span className="data-mono">{fmt(shown.total)}</span></div>
              </div>
              {shown.notes && <p className="text-sm text-[#5a5c62] whitespace-pre-wrap break-words border-t border-gray-100 pt-3">{shown.notes}</p>}
            </div>
          </div>

          {status !== 'converted' && (
            <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Drawings</h2>
                  <p className="text-xs text-[#8a8c94] mt-1">The client sees watermarked previews only. On conversion they move to the project and unlock when the invoice is paid.</p>
                </div>
                {editable && <ProposalDrawingUpload proposalId={p.id} watermarkText={watermarkText} />}
              </div>
              <div className="px-4 sm:px-6 py-3">
                <ProposalDrawingList proposalId={p.id} drawings={drawings} editable={editable} />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card h-fit min-w-0">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100"><h2 className="text-sm font-semibold text-gray-900">Versions & responses</h2></div>
          <div className="p-4 sm:p-6">
            <VersionHistory versions={versions} responses={responses} />
          </div>
        </div>
      </div>
    </div>
  )
}
