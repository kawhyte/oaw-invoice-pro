import 'server-only'
import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { and, eq, gte } from 'drizzle-orm'
import { db, proposal_responses } from '@/db'

// DB-backed limits for the public (no-login) proposal actions. Serverless
// instances share no memory, and the free tier has no Redis, so the
// proposal_responses rows themselves are the counter.

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_PROPOSAL = 5
const MAX_PER_IP = 20

/** Salted hash of the caller's IP — the raw IP is never stored. */
export async function clientIpHash(): Promise<string> {
  const h = await headers()
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim()
  return createHash('sha256').update(`${process.env.BETTER_AUTH_SECRET ?? ''}:${ip}`).digest('hex').slice(0, 32)
}

/**
 * Change notes are capped per proposal; accepting is not (it can only succeed
 * once, and a burst of notes must never block the client from accepting).
 * The per-IP cap applies to both.
 */
export async function assertProposalResponseAllowed(proposalId: string, ipHash: string, kind: 'accept' | 'changes'): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const [perProposal, perIp] = await Promise.all([
    kind === 'accept' ? 0 : db.$count(proposal_responses, and(
      eq(proposal_responses.proposal_id, proposalId), eq(proposal_responses.kind, 'changes'), gte(proposal_responses.created_at, since))),
    db.$count(proposal_responses, and(eq(proposal_responses.ip_hash, ipHash), gte(proposal_responses.created_at, since))),
  ])
  if (perProposal >= MAX_PER_PROPOSAL || perIp >= MAX_PER_IP) {
    throw new Error('Too many responses — please try again later or message us directly.')
  }
}
