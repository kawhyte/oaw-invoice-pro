import type {
  ProposalItemCategory, ProposalSnapshot, ProposalSnapshotItem, ProposalStatus, StoredProposalStatus,
  Currency, DiscountType,
} from '@/types'
import { PROPOSAL_CATEGORIES } from '@/types'
import { computeTotals, lineSubtotal, round2 } from '@/lib/invoiceCalc'
import { todayInBusinessTz } from '@/lib/dates'

// Pure proposal logic shared by server actions, the owner UI, the public share
// page and the PDF. No server-only imports — safe in client bundles.

/**
 * 'expired' is derived, never stored: an open (sent/revised) proposal whose
 * valid_until is before today in Jamaica. valid_until itself is still valid.
 */
export function effectiveStatus(
  p: { status: StoredProposalStatus; valid_until: string },
  today: string = todayInBusinessTz(),
): ProposalStatus {
  if ((p.status === 'sent' || p.status === 'revised') && p.valid_until < today) return 'expired'
  return p.status
}

/** Content can still change (accepted/declined/converted are the record). */
export function isEditable(status: ProposalStatus): boolean {
  return status === 'draft' || status === 'sent' || status === 'revised' || status === 'expired'
}

/** The client may respond (accept / request changes). */
export function isOpenForResponse(status: ProposalStatus): boolean {
  return status === 'sent' || status === 'revised'
}

export function categoryLabel(c: ProposalItemCategory | null | undefined): string {
  return PROPOSAL_CATEGORIES.find(x => x.value === c)?.label ?? 'General'
}

export function isCategory(v: unknown): v is ProposalItemCategory {
  return PROPOSAL_CATEGORIES.some(c => c.value === v)
}

export interface SnapshotSource {
  title: string
  scope: string | null
  job_type: string | null
  location_address: string | null
  recipient_name: string
  currency: Currency
  discount_type: DiscountType
  discount_value: number
  gct_rate: number
  additions_description: string | null
  additions_amount: number
  notes: string | null
}

export interface SnapshotItemSource {
  category: ProposalItemCategory | null
  description: string
  quantity: number
  unit_price: number
  sort_order?: number
}

/** Freezes a proposal + its items into a version snapshot. Totals are recomputed, never trusted. */
export function buildSnapshot(p: SnapshotSource, items: SnapshotItemSource[]): ProposalSnapshot {
  const sorted = [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const snapItems: ProposalSnapshotItem[] = sorted.map(i => ({
    category: i.category ?? null,
    description: i.description,
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    amount: round2(Number(i.quantity) * Number(i.unit_price)),
  }))
  const subtotal = lineSubtotal(snapItems)
  const discountValue = Number(p.discount_value) || 0
  const gctRate = Number(p.gct_rate) || 0
  const additionsAmount = Number(p.additions_amount) || 0
  const { discountAmount, gctAmount, total } = computeTotals({
    subtotal, discountType: p.discount_type, discountValue, gctRate, additionsAmount,
  })
  return {
    title: p.title,
    scope: p.scope ?? null,
    job_type: p.job_type ?? null,
    location_address: p.location_address ?? null,
    recipient_name: p.recipient_name,
    currency: p.currency,
    items: snapItems,
    subtotal,
    discount_type: p.discount_type,
    discount_value: discountValue,
    discount_amount: discountAmount,
    gct_rate: gctRate,
    gct_amount: gctAmount,
    additions_description: p.additions_description ?? null,
    additions_amount: additionsAmount,
    total,
    notes: p.notes ?? null,
  }
}

/** JSON with object keys sorted — jsonb reorders keys on storage, so plain stringify can't compare. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

export function snapshotsEqual(a: ProposalSnapshot, b: ProposalSnapshot): boolean {
  return canonical(a) === canonical(b)
}

export function formatMoney(n: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
}

const itemKey = (i: ProposalSnapshotItem) => `${i.category ?? ''}|${i.description.trim().toLowerCase()}`
const itemName = (i: ProposalSnapshotItem) => (i.category ? `${categoryLabel(i.category)} — ${i.description}` : i.description)

/** Human-readable list of what changed between two sent versions. */
export function diffVersions(prev: ProposalSnapshot, next: ProposalSnapshot): string[] {
  const out: string[] = []
  const m = (n: number) => formatMoney(n, next.currency)
  if (prev.currency !== next.currency) out.push(`Currency: ${prev.currency} → ${next.currency}`)
  if (prev.title !== next.title) out.push(`Title: “${prev.title}” → “${next.title}”`)
  if ((prev.scope ?? '') !== (next.scope ?? '')) out.push('Scope of work updated')

  const before = new Map((prev.items ?? []).map(i => [itemKey(i), i]))
  const after = new Map((next.items ?? []).map(i => [itemKey(i), i]))
  for (const [k, i] of after) {
    const old = before.get(k)
    if (!old) { out.push(`Added: ${itemName(i)} (${m(i.amount)})`); continue }
    if (old.unit_price !== i.unit_price) out.push(`Changed: ${itemName(i)} ${m(old.unit_price)} → ${m(i.unit_price)}`)
    if (old.quantity !== i.quantity) out.push(`Quantity: ${itemName(i)} ${old.quantity} → ${i.quantity}`)
  }
  for (const [k, i] of before) if (!after.has(k)) out.push(`Removed: ${itemName(i)} (${m(i.amount)})`)

  if (prev.discount_amount !== next.discount_amount) out.push(`Discount: ${m(prev.discount_amount)} → ${m(next.discount_amount)}`)
  if (prev.gct_rate !== next.gct_rate) out.push(next.gct_rate > 0 ? 'GCT (15%) added' : 'GCT removed')
  if (prev.additions_amount !== next.additions_amount) out.push(`${next.additions_description || 'Additions'}: ${m(prev.additions_amount)} → ${m(next.additions_amount)}`)
  if ((prev.notes ?? '') !== (next.notes ?? '')) out.push('Notes updated')
  if (prev.total !== next.total) out.push(`Total: ${m(prev.total)} → ${m(next.total)}`)
  return out
}

/** Invoices have no category column, so equipment/materials keep their label in the description. */
export function invoiceDescription(i: { category: ProposalItemCategory | null; description: string }): string {
  return i.category === 'equipment' || i.category === 'materials'
    ? `${categoryLabel(i.category)}: ${i.description}`
    : i.description
}

/** Items grouped by category in a fixed order (labour, equipment, materials, then uncategorised). */
export function groupByCategory<T extends { category: ProposalItemCategory | null }>(items: T[]) {
  const order: (ProposalItemCategory | null)[] = ['labour', 'equipment', 'materials', null]
  return order
    .map(c => ({ category: c, label: categoryLabel(c), items: items.filter(i => (i.category ?? null) === c) }))
    .filter(g => g.items.length > 0)
}
