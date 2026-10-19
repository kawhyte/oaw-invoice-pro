'use server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export async function login(formData: FormData) {
  try {
    // nextCookies() (in lib/auth) writes the session cookie from this server action.
    await auth.api.signInEmail({
      body: {
        email: String(formData.get('email') ?? '').trim(),
        password: String(formData.get('password') ?? ''),
      },
      headers: await headers(),
    })
  } catch {
    redirect('/login?error=1')
  }
  redirect('/dashboard')
}

export async function logout() {
  await auth.api.signOut({ headers: await headers() })
  redirect('/login')
}
