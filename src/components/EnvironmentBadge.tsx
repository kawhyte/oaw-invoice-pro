const STAGING_REF = 'ybexqyritucfnkepthbu'

export function EnvironmentBadge() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!url.includes(STAGING_REF)) return null
  return (
    <div
      data-env="staging"
      className="pointer-events-none fixed bottom-2 left-2 z-[9999] rounded-md bg-amber-500 px-2 py-1 font-mono text-xs font-medium text-black shadow"
    >
      STAGING DB
    </div>
  )
}
