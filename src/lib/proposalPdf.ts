import 'server-only'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { and, desc, eq } from 'drizzle-orm'
import { db, business_settings, proposals, proposal_line_items, proposal_versions } from '@/db'
import { resolveLogoUrl } from '@/lib/storage'
import { buildSnapshot } from '@/lib/proposals'
import { ProposalDocument } from '@/components/proposals/ProposalDocument'
import type { BusinessSettings, ProposalSnapshot } from '@/types'

type ProposalRow = typeof proposals.$inferSelect

async function render(p: ProposalRow, snapshot: ProposalSnapshot, version: number | null, date: string) {
  const biz = await db.query.business_settings.findFirst({ where: eq(business_settings.user_id, p.user_id) })
  const bizSettings = biz ? ({ ...biz, logo_url: await resolveLogoUrl(biz.logo_url) } as BusinessSettings) : null
  const element = React.createElement(ProposalDocument, {
    snapshot, number: p.proposal_number, version, date, validUntil: p.valid_until,
    recipientPhone: p.recipient_phone, recipientEmail: p.recipient_email, bizSettings,
  })
  // renderToBuffer is typed for <Document> elements; ProposalDocument renders one.
  const buffer = await renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0])
  return { buffer: Buffer.from(buffer), fileName: `${p.proposal_number}${version ? `-v${version}` : ''}.pdf` }
}

async function latestVersion(proposalId: string) {
  const [v] = await db.select().from(proposal_versions)
    .where(eq(proposal_versions.proposal_id, proposalId)).orderBy(desc(proposal_versions.version)).limit(1)
  return v ?? null
}

/**
 * Owner PDF. `draft=true` (or a never-sent proposal) renders the current
 * unsent content; otherwise the latest sent version — what the client has.
 */
export async function renderProposalPdf(proposalId: string, userId: string, opts: { draft?: boolean } = {}) {
  const [p] = await db.select().from(proposals)
    .where(and(eq(proposals.id, proposalId), eq(proposals.user_id, userId))).limit(1)
  if (!p) return null
  const v = opts.draft ? null : await latestVersion(p.id)
  if (v) return render(p, v.snapshot, v.version, v.sent_at)
  const items = await db.select().from(proposal_line_items).where(eq(proposal_line_items.proposal_id, p.id))
  return render(p, buildSnapshot(p, items), null, new Date().toISOString())
}

/** Public PDF (share link): latest SENT version only; null if never sent. */
export async function renderProposalPdfByToken(token: string) {
  const [p] = await db.select().from(proposals).where(eq(proposals.share_token, token)).limit(1)
  if (!p) return null
  const v = await latestVersion(p.id)
  if (!v) return null
  return render(p, v.snapshot, v.version, v.sent_at)
}
