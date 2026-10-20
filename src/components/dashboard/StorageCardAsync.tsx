import { totalBytes } from '@/lib/storage'
import { FREE_STORAGE_BYTES } from '@/lib/uploadLimits'
import { StorageCard } from './StorageCard'

// Real bytes stored in the bucket (one B2 list call per 1000 objects). Streamed
// in its own Suspense boundary so this external call never delays the dashboard.
// Falls back to 0 if storage is unreachable.
export async function StorageCardAsync() {
  const used = await totalBytes().catch(() => 0)
  return <StorageCard usedBytes={used} limitBytes={FREE_STORAGE_BYTES} />
}
