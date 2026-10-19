import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/db'
import * as authSchema from '@/db/auth-schema'

// Single-owner app: one email/password account, sign-up disabled. The owner
// account is created once by scripts/create-owner.ts with ALLOW_OWNER_SIGNUP=1
// and OWNER_ID set to the old Supabase auth user id, so every existing
// user_id row and storage key ("<user_id>/...") stays valid.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.ALLOW_OWNER_SIGNUP !== '1',
    minPasswordLength: 10,
  },
  // 60-day rolling session so the phone app stays signed in.
  session: { expiresIn: 60 * 60 * 24 * 60, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, window: 60, max: 10 },
  advanced: { database: { generateId: 'uuid' } },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => (process.env.OWNER_ID ? { data: { ...user, id: process.env.OWNER_ID } } : { data: user }),
      },
    },
  },
  plugins: [nextCookies()],
})
