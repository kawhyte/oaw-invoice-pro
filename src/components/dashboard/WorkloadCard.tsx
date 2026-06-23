import { capacityView } from '@/lib/capacity'

interface Props { load: number; max: number }

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

/**
 * Solo-worker capacity gauge. Sums the difficulty weight of active projects
 * (the "load") and shows it against a personal ceiling. Turns amber as it
 * nears full and red when over — same pattern as the budget tracker.
 */
export function WorkloadCard({ load, max }: Props) {
  const { pct, zone } = capacityView(load, max)
  const barColor = zone === 'over' ? 'bg-red-500' : zone === 'near' ? 'bg-amber-500' : 'bg-[#715a3e]'
  const idle = load <= 0

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1a1c1e]">Workload</h2>
        <span className="text-xs text-[#8a8c94] data-mono">{fmt(load)} / {fmt(max)} pts</span>
      </div>
      <div className="p-6 space-y-3">
        {idle ? (
          <p className="text-sm text-[#8a8c94]">No active work right now.</p>
        ) : (
          <>
            <div className="h-2 w-full rounded-full bg-[#f0f0f2] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
            {zone === 'over' && (
              <p className="text-xs text-red-600">Over capacity — consider delaying new work.</p>
            )}
            {zone === 'near' && (
              <p className="text-xs text-amber-600">Approaching full capacity.</p>
            )}
            {zone === 'ok' && (
              <p className="text-xs text-[#8a8c94]"> You are {Math.round(pct)}% booked — you have room to take on more work.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
