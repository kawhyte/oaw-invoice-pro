// scripts/check-env.mjs
// Usage:
//   node scripts/check-env.mjs <file>   -> validate one profile file (used by pre-scripts); exit 1 on failure
//   node scripts/check-env.mjs          -> report which Supabase project each profile points to
import { readFileSync, existsSync } from 'node:fs'

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CRON_SECRET',
] // RESEND_TO_OVERRIDE intentionally not required

const REFS = {
  ybexqyritucfnkepthbu: 'STAGING',
  wponxcekzuxwkuentklz: 'PRODUCTION',
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
  const url = vars.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = Object.keys(REFS).find((r) => url.includes(r))
  const label = ref ? REFS[ref] : 'UNKNOWN PROJECT'
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
