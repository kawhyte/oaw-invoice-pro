// scripts/check-env.mjs
// Usage:
//   node scripts/check-env.mjs <file>   -> validate one profile file (used by pre-scripts); exit 1 on failure
//   node scripts/check-env.mjs          -> report which Neon branch each profile points to
import { readFileSync, existsSync } from 'node:fs'

const REQUIRED = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'STORAGE_ENDPOINT',
  'STORAGE_REGION',
  'STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY_ID',
  'STORAGE_SECRET_ACCESS_KEY',
]

// Neon endpoint ids (host prefix) of each branch, so a profile can never
// silently point at the wrong database.
const REFS = {
  'ep-silent-unit-b8zt7nlx': 'STAGING',
}

function parse(file) {
  const vars = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) vars[m[1]] = m[2].trim()
  }
  return vars
}

function describe(file) {
  const vars = parse(file)
  let host = ''
  try { host = new URL(vars.DATABASE_URL ?? '').hostname } catch {}
  const ref = Object.keys(REFS).find((r) => host.startsWith(r))
  const label = ref ? REFS[ref] : (host ? 'PRODUCTION?' : 'NO DATABASE')
  const url = host.split('.')[0]
  const missing = REQUIRED.filter((k) => !vars[k])
  return { label, ref: ref ?? url, missing }
}

const target = process.argv[2]

if (target) {
  if (!existsSync(target)) {
    console.error(`\n[check-env] FATAL: ${target} does not exist.`)
    console.error(`[check-env] Create it (see .env.example) before running this script.\n`)
    process.exit(1)
  }
  const { label, ref, missing } = describe(target)
  if (missing.length > 0) {
    console.error(`\n[check-env] FATAL: ${target} is missing: ${missing.join(', ')}\n`)
    process.exit(1)
  }
  console.log(`[check-env] ${target} -> ${label} (${ref})`)
} else {
  for (const file of ['.env.staging.local', '.env.prod.local']) {
    if (!existsSync(file)) {
      console.log(`${file.padEnd(22)} -> MISSING`)
      continue
    }
    const { label, ref, missing } = describe(file)
    const warn = missing.length ? `  (missing: ${missing.join(', ')})` : ''
    console.log(`${file.padEnd(22)} -> ${label} (${ref})${warn}`)
  }
}
