import type { Metadata, Viewport } from 'next'
import { desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db, business_settings, proposals, proposal_versions, proposal_drawings } from '@/db'
import { signedGetUrl } from '@/lib/storage'
import { StatusChip } from '@/components/ui/StatusChip'
import { DrawingViewer } from '@/components/share/DrawingViewer'
import { daysBetween, todayInBusinessTz } from '@/lib/dates'
import { diffVersions, effectiveStatus, formatMoney, groupByCategory, isOpenForResponse } from '@/lib/proposals'
import { ProposalResponseForm } from './ProposalResponseForm'

// Same pinch-zoom allowance as the project share page (drawings need zooming).
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, userScalable: true }
export const metadata: Metadata = { title: 'Proposal', robots: { index: false, follow: false } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const longDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00Z` : d)
  .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Jamaica' })

export default async function ProposalSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // Public page: no session. The unguessable token is the only credential.
  if (!UUID.test(token)) notFound()

  const [p] = await db.select().from(proposals).where(eq(proposals.share_token, token)).limit(1)
  if (!p) notFound()

  // The client only ever sees SENT versions — never the owner's unsent edits.
  const versions = await db.select().from(proposal_versions)
    .where(eq(proposal_versions.proposal_id, p.id)).orderBy(desc(proposal_versions.version)).limit(2)
  const latest = versions[0]
  if (!latest) notFound()
  const previous = versions[1]
  const snap = latest.snapshot

  const [biz, drawingRows] = await Promise.all([
    db.query.business_settings.findFirst({
      columns: { business_name: true, phone: true, email: true },
      where: eq(business_settings.user_id, p.user_id),
    }),
    db.select().from(proposal_drawings).where(eq(proposal_drawings.proposal_id, p.id)).orderBy(desc(proposal_drawings.created_at)),
  ])

  // Watermarked previews only — the original PDF is never signed for a proposal.
  const signUrl = (path: string) => signedGetUrl(path, 86400)
  const drawings = await Promise.all(drawingRows.map(async d => {
    const previews = await Promise.all((d.preview_paths ?? []).map(signUrl))
    const zooms = await Promise.all((d.zoom_paths ?? []).map(signUrl))
    return { id: d.id, name: d.name, pages: previews.map((preview, i) => ({ preview, zoom: zooms[i] || preview })).filter(x => x.preview) }
  }))

  const today = todayInBusinessTz()
  const status = effectiveStatus(p, today)
  const daysLeft = daysBetween(today, p.valid_until)
  const fmt = (n: number) => formatMoney(n, snap.currency)
  const groups = groupByCategory(snap.items ?? [])
  const showGroups = groups.length > 1 || (groups[0]?.category ?? null) !== null
  const changes = previous ? diffVersions(previous.snapshot, snap) : []
  const businessName = biz?.business_name || 'OW Studio'
  const contact = [biz?.phone, biz?.email].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#1a1c1e]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <span className="font-semibold text-white text-sm truncate">{businessName}</span>
          <StatusChip status={status} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <p className="text-xs text-[#8a8c94] data-mono">{p.proposal_number} · Version {latest.version} · {longDate(latest.sent_at)}</p>
          <h1 className="text-2xl font-bold text-[#1a1c1e] mt-1 break-words">{snap.title}</h1>
          <p className="text-[#5a5c62] text-sm mt-1">Prepared for {snap.recipient_name}</p>
          {(snap.job_type || snap.location_address) && (
            <p className="text-[#8a8c94] text-sm mt-0.5">{[snap.job_type, snap.location_address].filter(Boolean).join(' · ')}</p>
          )}
        </div>

        {/* Validity */}
        {status === 'expired' ? (
          <div className="rounded-xl border border-[#93000a]/20 bg-[#ffdad6] px-5 py-3">
            <p className="text-sm font-semibold text-[#93000a]">This proposal expired on {longDate(p.valid_until)}.</p>
            <p className="text-xs text-[#93000a] mt-0.5">Please contact {businessName}{contact ? ` (${contact})` : ''} for an updated proposal.</p>
          </div>
        ) : isOpenForResponse(status) ? (
          <div className="rounded-xl border border-[#e0e0e3] bg-white px-5 py-3 text-sm text-[#5a5c62]">
            Valid until <span className="font-semibold text-[#1a1c1e]">{longDate(p.valid_until)}</span>
            {' '}({daysLeft === 0 ? 'last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`})
          </div>
        ) : null}

        {(status === 'accepted' || status === 'converted') && p.accepted_at && (
          <div className="rounded-xl border border-[#2a5130]/30 bg-[#dde8dd] px-5 py-3">
            <p className="text-sm font-semibold text-[#2a5130]">
              Accepted{p.accepted_by_name && !p.accepted_by_name.startsWith('(') ? ` by ${p.accepted_by_name}` : ''} on {longDate(p.accepted_at)}.
            </p>
          </div>
        )}
        {status === 'declined' && (
          <div className="rounded-xl border border-[#e0e0e3] bg-[#e7e8e9] px-5 py-3">
            <p className="text-sm font-semibold text-[#44474a]">This proposal is closed.</p>
          </div>
        )}

        {changes.length > 0 && (
          <div className="rounded-xl border border-[#715a3e]/20 bg-[#f5ede4] px-5 py-4">
            <h2 className="label-caps text-[#715a3e]">What changed since version {previous!.version}</h2>
            <ul className="mt-2 space-y-1 text-sm text-[#584329] list-disc pl-5">
              {changes.map((c, i) => <li key={i} className="break-words">{c}</li>)}
            </ul>
          </div>
        )}

        {snap.scope && (
          <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-5">
            <h2 className="label-caps mb-2">Scope of work</h2>
            <p className="text-sm text-[#5a5c62] whitespace-pre-wrap break-words">{snap.scope}</p>
          </div>
        )}

        {/* Items */}
        <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
          <div className="px-5 py-4 border-b border-gray-100"><h2 className="label-caps">Pricing</h2></div>
          <div className="p-5 space-y-5">
            {groups.map(g => (
              <div key={g.label}>
                {showGroups && <h3 className="text-xs font-semibold text-[#715a3e] uppercase tracking-wide mb-2">{g.label}</h3>}
                <div className="divide-y divide-gray-100">
                  {g.items.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm text-[#1a1c1e] break-words">{item.description}</p>
                        <p className="text-xs text-[#8a8c94] data-mono">{item.quantity} × {fmt(item.unit_price)}</p>
                      </div>
                      <span className="text-sm text-[#1a1c1e] data-mono shrink-0">{fmt(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="border-t border-[#e0e0e3] pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-[#5a5c62]"><span>Subtotal</span><span className="data-mono">{fmt(snap.subtotal)}</span></div>
              {snap.discount_amount > 0 && (
                <div className="flex justify-between text-[#5a5c62]">
                  <span>Discount{snap.discount_type === 'percentage' ? ` (${snap.discount_value}%)` : ''}</span>
                  <span className="data-mono">- {fmt(snap.discount_amount)}</span>
                </div>
              )}
              {snap.gct_rate > 0 && <div className="flex justify-between text-[#5a5c62]"><span>GCT (15%)</span><span className="data-mono">{fmt(snap.gct_amount)}</span></div>}
              {snap.additions_amount > 0 && (
                <div className="flex justify-between gap-3 text-[#5a5c62]"><span className="min-w-0 break-words">{snap.additions_description || 'Additions'}</span><span className="data-mono shrink-0">+ {fmt(snap.additions_amount)}</span></div>
              )}
              <div className="flex justify-between font-bold text-[#1a1c1e] text-base pt-2 border-t border-[#e0e0e3]">
                <span>Total</span><span className="data-mono">{fmt(snap.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {snap.notes && (
          <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-5">
            <h2 className="label-caps mb-2">Notes</h2>
            <p className="text-sm text-[#5a5c62] whitespace-pre-wrap break-words">{snap.notes}</p>
          </div>
        )}

        {drawings.length > 0 && (
          <div className="space-y-3">
            <h2 className="label-caps px-1">Drawings</h2>
            {drawings.map(d => (
              <div key={d.id} className="bg-white rounded-xl border border-[#e0e0e3] shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100"><h3 className="label-caps truncate">{d.name}</h3></div>
                <div className="p-4 sm:p-6 space-y-3">
                  {d.pages.length === 0
                    ? <p className="text-sm text-[#8a8c94]">Preview is being prepared.</p>
                    : <DrawingViewer name={d.name} pages={d.pages} />}
                  <p className="text-xs text-[#8a8c94] text-center">Preview for review only.</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <a href={`/share/proposal/${token}/pdf`} target="_blank" rel="noopener noreferrer"
          className="block w-full text-center btn-secondary px-4 py-2.5 text-sm rounded-lg">
          Download PDF
        </a>

        {isOpenForResponse(status) && (
          <ProposalResponseForm token={token} version={latest.version} total={fmt(snap.total)} />
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-4 py-8 text-center text-xs text-[#8a8c94]">
        A secure proposal link from {businessName}{contact ? ` · ${contact}` : ''}
      </footer>
    </div>
  )
}
