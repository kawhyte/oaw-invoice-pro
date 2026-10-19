// Compares every public table between Supabase (source) and Neon (target):
// row count + md5 of all rows (ordered by primary key). Exit 0 only if all match.
// Usage: npx dotenv -e .env.staging.local -- node scripts/verify-migration.mjs
import pg from 'pg'

const src = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL })
const dst = new pg.Client({ connectionString: process.env.DATABASE_URL })
await src.connect()
await dst.connect()

const tables = (await src.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`
)).rows.map((r) => r.table_name)

async function fingerprint(client, table) {
  const pk = (await client.query(
    `select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
     where i.indrelid = $1::regclass and i.indisprimary order by a.attnum`, [`public.${table}`]
  )).rows.map((r) => `"${r.attname}"`).join(', ') || '1'
  const r = await client.query(
    `select count(*)::int as n, coalesce(md5(string_agg(t::text, '|' order by ${pk})), '-') as h from public."${table}" t`
  )
  return r.rows[0]
}

let ok = true
for (const t of tables) {
  const a = await fingerprint(src, t)
  let b
  try { b = await fingerprint(dst, t) } catch { b = { n: 'missing', h: '' } }
  const same = a.n === b.n && a.h === b.h
  ok &&= same
  console.log(`${same ? 'OK  ' : 'DIFF'} ${t.padEnd(22)} supabase=${a.n} neon=${b.n}${same || a.n !== b.n ? '' : ' (content differs)'}`)
}
await src.end()
await dst.end()
process.exit(ok ? 0 : 1)
