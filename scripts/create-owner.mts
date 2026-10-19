// One-time per environment: create the single owner account in Better Auth,
// reusing the old Supabase auth user id + email so every user_id row and every
// storage key ("<user_id>/...") stays valid.
//
// Usage (password comes from the env, never the command line or chat):
//   OWNER_PASSWORD='…' npx dotenv -e .env.staging.local -- npx tsx scripts/create-owner.mts
// Needs SUPABASE_DB_URL (source of id/email) and DATABASE_URL (Neon) in the env file.
import pg from 'pg'

const password = process.env.OWNER_PASSWORD
if (!password || password.length < 10) {
  console.error('Set OWNER_PASSWORD (at least 10 characters).')
  process.exit(1)
}

const src = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL })
await src.connect()
const users = (await src.query('select id, email from auth.users order by created_at')).rows as { id: string; email: string }[]
await src.end()
if (users.length !== 1) {
  console.error(`Expected exactly 1 Supabase auth user, found ${users.length}. Aborting.`)
  process.exit(1)
}
const { id, email } = users[0]

// Enable owner sign-up + id override only for this process, before auth loads.
process.env.ALLOW_OWNER_SIGNUP = '1'
process.env.OWNER_ID = id
const { auth } = await import('../src/lib/auth')

const res = await auth.api.signUpEmail({ body: { email, password, name: 'Owner' } })
const ok = res.user.id === id

// Sign-up auto-creates a session nobody holds a cookie for — remove it.
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
await db.query('delete from "session" where user_id = $1', [id])
await db.end()
console.log(ok ? `Owner account created (id preserved: ${id.slice(0, 8)}…)` : `ID MISMATCH: got ${res.user.id}`)
process.exit(ok ? 0 : 1)
