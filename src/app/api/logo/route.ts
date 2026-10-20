import { eq } from 'drizzle-orm'
import { db, business_settings } from '@/db'
import { getUser } from '@/lib/session'
import { getObject } from '@/lib/storage'

export const runtime = 'nodejs'

// The signed-in owner's logo from a stable same-origin URL. Presigned B2 URLs
// change on every page load, so the phone re-downloaded the logo each open and
// the nav showed a blank square for about a second. Logo keys are unique per
// upload (logo-<ts>), so the nav links here as /api/logo?v=<key> and the
// browser keeps the image cached until a new logo is uploaded.
export async function GET() {
  const user = await getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const s = await db.query.business_settings.findFirst({
    columns: { logo_url: true },
    where: eq(business_settings.user_id, user.id),
  })
  const key = s?.logo_url
  if (!key || /^https?:\/\//.test(key)) return new Response('Not found', { status: 404 })

  const obj = await getObject(key)
  if (!obj) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(obj.body), {
    headers: {
      'Content-Type': obj.contentType.startsWith('image/') ? obj.contentType : 'application/octet-stream',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
