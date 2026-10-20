import { NextResponse, type NextRequest } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

// Optimistic gate only: checks that a session cookie exists. The real check
// (valid, unexpired session) runs in every page/action via lib/session.ts.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/offline') ||
    pathname.startsWith('/launch')
  const hasSession = !!getSessionCookie(request)

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  // No "/login → /dashboard" redirect here: a stale cookie would loop with the
  // dashboard's real check. The login page redirects itself when truly signed in.
  return NextResponse.next()
}

export const config = {
  // Exclude Next internals and static assets (images, fonts, and JS/CSS such as
  // the pdf.js worker /pdf.worker.min.mjs) so auth never redirects them — a
  // redirected worker fetch breaks pdf.js.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs|js|css|woff2?|ttf|ico|json|webmanifest|txt)$).*)'],
}
