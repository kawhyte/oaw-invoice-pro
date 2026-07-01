import { capacityView } from '@/lib/capacity'
import { formatGB } from '@/lib/uploadLimits'

interface Props { usedBytes: number; limitBytes: number }

/**
 * Free-plan storage meter. Shows total Supabase Storage used against the 1 GB
 * cap so the owner stays under it. Compact card matched to WorkloadCard's
 * compact variant (paired side-by-side on the Dashboard): turns amber near full
 * (>=80%) and red when over. Explanatory text only appears when near/over —
 * the healthy state is intentionally minimal.
 */
export function StorageCard({ usedBytes, limitBytes }: Props) {
  const { pct, zone } = capacityView(usedBytes, limitBytes)
  const barColor = zone === 'over' ? 'bg-red-500' : zone === 'near' ? 'bg-amber-500' : 'bg-[#715a3e]'
  const leftBytes = Math.max(limitBytes - usedBytes, 0)

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1a1c1e]">File Storage</h2>
        <span className="text-xs text-[#8a8c94] data-mono">{formatGB(usedBytes)} / {formatGB(limitBytes)}</span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-[#f0f0f2] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[#8a8c94]">For the documents, drawings &amp; logos you upload</p>
      {zone === 'over' && (
        <p className="mt-1 text-xs text-red-600">Full — delete files to upload more.</p>
      )}
      {zone === 'near' && (
        <p className="mt-1 text-xs text-amber-600">Almost full — {formatGB(leftBytes)} left. Uploads stop at 100%.</p>
      )}
    </div>
  )
}
