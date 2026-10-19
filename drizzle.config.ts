import { defineConfig } from 'drizzle-kit'

// Run with an env profile, e.g.:
//   npx dotenv -e .env.staging.local -- npx drizzle-kit generate
export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/db/schema.ts', './src/db/auth-schema.ts'],
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Keep snake_case keys — the whole UI and src/types expect them.
  introspect: { casing: 'preserve' },
})
