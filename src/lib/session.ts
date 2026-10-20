import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/** The signed-in owner, or null. Reads the Better Auth session cookie.
 *  cache(): the layout, page and nav all ask within one request — one DB lookup. */
export const getUser = cache(async () => {
  const s = await auth.api.getSession({ headers: await headers() })
  return s?.user ?? null
})

/** For server actions / route handlers: throws when signed out. */
export async function requireUser() {
  const u = await getUser()
  if (!u) throw new Error('Unauthorized')
  return u
}

/** For pages / layouts: redirects to /login when signed out. */
export async function requireUserPage() {
  const u = await getUser()
  if (!u) redirect('/login')
  return u
}
