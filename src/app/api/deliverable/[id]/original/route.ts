import { and, eq } from 'drizzle-orm'
import { db, projects, project_deliverables } from '@/db'
import { getUser } from '@/lib/session'
import { getObjectStream } from '@/lib/storage'

export const runtime = 'nodejs'
export const maxDuration = 300

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Owner only: hands the stored original back to the owner's device so it can
// build the watermarked full-detail version without a re-upload.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!UUID.test(id)) return new Response('Not found', { status: 404 })
  const [row] = await db.select({ path: project_deliverables.storage_path })
    .from(project_deliverables)
    .innerJoin(projects, eq(projects.id, project_deliverables.project_id))
    .where(and(eq(project_deliverables.id, id), eq(projects.user_id, user.id))).limit(1)
  const obj = row ? await getObjectStream(row.path) : null
  if (!obj) return new Response('Not found', { status: 404 })
  return new Response(obj.stream, {
    headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'private, no-store' },
  })
}
