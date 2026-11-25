import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db, projects, project_deliverables, invoices } from '@/db'
import { reviewAccess, type ReviewAccess } from '@/lib/deliverables'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Resolves a drawing through a project's share token and works out, right now,
 *  what the holder may see. Every public drawing route goes through this. */
export async function sharedDrawing(token: string, id: string) {
  if (!UUID.test(token) || !UUID.test(id)) return null
  const [row] = await db.select({ d: project_deliverables, projectTitle: projects.title })
    .from(project_deliverables)
    .innerJoin(projects, eq(projects.id, project_deliverables.project_id))
    .where(and(eq(project_deliverables.id, id), eq(projects.share_token, token))).limit(1)
  if (!row) return null
  const [invoice] = row.d.linked_invoice_id
    ? await db.select({ status: invoices.status, total: invoices.total, amount_paid: invoices.amount_paid })
        .from(invoices).where(eq(invoices.id, row.d.linked_invoice_id)).limit(1)
    : []
  const access: ReviewAccess = reviewAccess(row.d, invoice ?? null)
  return { ...row, access }
}

/** A filename safe for Content-Disposition (plain ASCII, no path characters). */
export function safeFileName(s: string): string {
  return s.replace(/[^\x20-\x7e]+/g, ' ').replace(/[\\/:*?"<>|;%]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Drawing'
}
