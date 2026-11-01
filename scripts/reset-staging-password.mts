// Set a new password for the owner account on the STAGING database only (for
// when the staging login is forgotten). Refuses to run against any other DB.
//
// Usage (password comes from the env, never the command line or chat):
//   read -s NEW_PASSWORD && export NEW_PASSWORD && npx dotenv -e .env.staging.local -- npx tsx scripts/reset-staging-password.mts
import pg from 'pg'
import { hashPassword } from 'better-auth/crypto'

const STAGING_REF = 'ep-silent-unit-b8zt7nlx' // same id check-env.mjs labels STAGING

const password = process.env.NEW_PASSWORD
if (!password || password.length < 10) {
  console.error('Set NEW_PASSWORD (at least 10 characters).')
  process.exit(1)
}

const url = process.env.DATABASE_URL ?? ''
let host = ''
try { host = new URL(url).hostname } catch {}
if (!host.startsWith(STAGING_REF)) {
  console.error(`Refusing: DATABASE_URL is not the staging branch (${host.split('.')[0] || 'none'}).`)
  process.exit(1)
}

const db = new pg.Client({ connectionString: url })
await db.connect()
const res = await db.query(
  `update account set password = $1, updated_at = now() where provider_id = 'credential' returning user_id`,
  [await hashPassword(password)],
)
await db.end()
console.log(res.rowCount === 1 ? 'Staging password updated.' : `Expected 1 account, updated ${res.rowCount}.`)
process.exit(res.rowCount === 1 ? 0 : 1)
