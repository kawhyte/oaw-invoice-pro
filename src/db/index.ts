import { Pool, neonConfig, types } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import * as schema from './schema'
import * as relations from './relations'
import * as authSchema from './auth-schema'

// Server-only module (imports node `ws`); never import it from a client component.

neonConfig.webSocketConstructor = ws

// Match PostgREST's (Supabase's) JSON output so existing UI code is unchanged:
// timestamps as ISO-8601 strings ("2026-10-19T12:00:00.000Z") instead of
// Postgres text ("2026-10-19 12:00:00+00"), which date math and Safari mis-parse.
// Only timestamptz (all business tables): Better Auth's own tables use plain
// timestamp in Drizzle's Date mode, which must keep receiving raw driver text.
types.setTypeParser(1184, (v: string) => new Date(v).toISOString())

const globalForDb = globalThis as unknown as { __owPool?: Pool }
// Reuse one pool across hot reloads in dev.
const pool = globalForDb.__owPool ?? new Pool({ connectionString: process.env.DATABASE_URL })
if (process.env.NODE_ENV !== 'production') globalForDb.__owPool = pool

export const db = drizzle({ client: pool, schema: { ...schema, ...relations, ...authSchema } })
export type Db = typeof db
export * from './schema'
