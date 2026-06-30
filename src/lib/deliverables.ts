// ============================================================================
// Deliverable payment-gate logic — the single source of truth for whether a
// client may download the clean, print-ready original.
//
// Used by BOTH the owner project page (so the architect sees the true lock
// state) and the public share page (which actually enforces the gate by only
// emitting the original's URL when this returns true).
// ============================================================================

export interface GateDeliverable {
  manual_unlock: boolean
  linked_invoice_id: string | null
}

export interface GateInvoice {
  status: string
  amount_paid: number | null
  total: number
}

/**
 * Final is unlocked when the architect manually releases it, OR the linked
 * invoice is fully paid. An unlinked deliverable can only be opened manually.
 */
export function isFinalUnlocked(d: GateDeliverable, invoice?: GateInvoice | null): boolean {
  if (d.manual_unlock) return true
  if (!invoice) return false
  return invoice.status === 'paid' || Number(invoice.amount_paid ?? 0) >= Number(invoice.total)
}
