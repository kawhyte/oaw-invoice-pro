'use server'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db, proposals, proposal_versions, proposal_responses } from '@/db'
import { effectiveStatus, isOpenForResponse } from '@/lib/proposals'
import { assertProposalResponseAllowed, clientIpHash } from '@/lib/rateLimit'

// PUBLIC actions (no login): the share token is the only credential. Only these
// two functions are exported — every export of a 'use server' file is callable.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Result = { ok: true } | { ok: false; error: string }

async function loadOpenProposal(token: string, version: number) {
  if (typeof token !== 'string' || !UUID.test(token)) return { error: 'This link is not valid.' } as const
  const [p] = await db.select({
    id: proposals.id, status: proposals.status, valid_until: proposals.valid_until, share_token: proposals.share_token,
  }).from(proposals).where(eq(proposals.share_token, token)).limit(1)
  if (!p) return { error: 'This link is not valid.' } as const
  const status = effectiveStatus(p)
  if (status === 'expired') return { error: 'This proposal has expired. Please contact us for an updated one.' } as const
  if (!isOpenForResponse(status)) return { error: 'This proposal is no longer open for responses.' } as const
  const [latest] = await db.select({ version: proposal_versions.version }).from(proposal_versions)
    .where(eq(proposal_versions.proposal_id, p.id)).orderBy(desc(proposal_versions.version)).limit(1)
  if (!latest) return { error: 'This link is not valid.' } as const
  // A stale tab must never accept an older price.
  if (!Number.isInteger(version) || version !== latest.version) {
    return { error: 'This proposal was updated since you opened it — please reload the page to see the latest version.' } as const
  }
  return { proposal: p, version: latest.version } as const
}

function revalidate(token: string, id: string) {
  revalidatePath(`/share/proposal/${token}`)
  revalidatePath(`/proposals/${id}`)
  revalidatePath('/proposals')
  revalidatePath('/dashboard')
}

export async function acceptProposalAction(token: string, version: number, name: string): Promise<Result> {
  const responder = String(name ?? '').trim()
  if (responder.length < 2) return { ok: false, error: 'Please type your full name to accept.' }
  if (responder.length > 100) return { ok: false, error: 'Name is too long.' }
  try {
    const loaded = await loadOpenProposal(token, version)
    if ('error' in loaded) return { ok: false, error: loaded.error as string }
    const ipHash = await clientIpHash()
    await assertProposalResponseAllowed(loaded.proposal.id, ipHash, 'accept')
    const now = new Date().toISOString()
    const accepted = await db.transaction(async (tx) => {
      // Conditional update: a double tap / second device finds it already accepted.
      const rows = await tx.update(proposals).set({
        status: 'accepted', accepted_at: now, accepted_version: loaded.version,
        accepted_by_name: responder, changes_requested_at: null, updated_at: now,
      }).where(and(eq(proposals.id, loaded.proposal.id), inArray(proposals.status, ['sent', 'revised'])))
        .returning({ id: proposals.id })
      if (rows.length === 0) return false
      await tx.insert(proposal_responses).values({
        proposal_id: loaded.proposal.id, version: loaded.version, kind: 'accept', responder_name: responder, ip_hash: ipHash,
      })
      return true
    })
    if (!accepted) return { ok: false, error: 'This proposal is no longer open for responses.' }
    revalidate(token, loaded.proposal.id)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.message.startsWith('Too many') ? err.message : 'Something went wrong — please try again.' }
  }
}

export async function requestProposalChangesAction(token: string, version: number, note: string, name: string): Promise<Result> {
  const text = String(note ?? '').trim()
  const responder = String(name ?? '').trim().slice(0, 100) || null
  if (text.length < 3) return { ok: false, error: 'Please tell us what you’d like changed.' }
  if (text.length > 2000) return { ok: false, error: 'Please keep the note under 2000 characters.' }
  try {
    const loaded = await loadOpenProposal(token, version)
    if ('error' in loaded) return { ok: false, error: loaded.error as string }
    const ipHash = await clientIpHash()
    await assertProposalResponseAllowed(loaded.proposal.id, ipHash, 'changes')
    const now = new Date().toISOString()
    await db.transaction(async (tx) => {
      await tx.insert(proposal_responses).values({
        proposal_id: loaded.proposal.id, version: loaded.version, kind: 'changes', responder_name: responder, note: text, ip_hash: ipHash,
      })
      await tx.update(proposals).set({ changes_requested_at: now })
        .where(and(eq(proposals.id, loaded.proposal.id), inArray(proposals.status, ['sent', 'revised'])))
    })
    revalidate(token, loaded.proposal.id)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.message.startsWith('Too many') ? err.message : 'Something went wrong — please try again.' }
  }
}
