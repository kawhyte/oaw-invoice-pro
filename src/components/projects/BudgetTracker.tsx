import type { ProjectTask } from '@/types'

interface Props { budget: number | null; tasks: ProjectTask[] }

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/**
 * Personal-project budget tracker. "Spent" rolls up from checklist item costs.
 * Shows a progress bar that turns amber as it approaches and red when over budget.
 */
export function BudgetTracker({ budget, tasks }: Props) {
  const spent = tasks.reduce((sum, t) => sum + (t.cost != null ? Number(t.cost) : 0), 0)
  const hasBudget = budget != null && budget > 0
  const remaining = hasBudget ? (budget as number) - spent : 0
  const pct = hasBudget ? Math.min((spent / (budget as number)) * 100, 100) : 0
  const over = hasBudget && spent > (budget as number)
  const near = hasBudget && !over && pct >= 80

  const barColor = over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-[#715a3e]'

  return (
    <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="label-caps">Budget</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="label-caps mb-1">Budget</p>
            <p className="text-lg font-semibold text-[#1a1c1e] data-mono">{hasBudget ? fmt(budget as number) : '—'}</p>
          </div>
          <div>
            <p className="label-caps mb-1">Spent</p>
            <p className="text-lg font-semibold text-[#1a1c1e] data-mono">{fmt(spent)}</p>
          </div>
          <div>
            <p className="label-caps mb-1">{over ? 'Over by' : 'Remaining'}</p>
            <p className={`text-lg font-semibold data-mono ${over ? 'text-red-600' : 'text-[#2a5130]'}`}>
              {hasBudget ? fmt(Math.abs(remaining)) : '—'}
            </p>
          </div>
        </div>

        {hasBudget && (
          <div>
            <div className="h-2 w-full rounded-full bg-[#f0f0f2] overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.max(pct, spent > 0 ? 4 : 0)}%` }} />
            </div>
            {over && <p className="text-xs text-red-600 mt-2">You&apos;re over budget.</p>}
            {near && <p className="text-xs text-amber-600 mt-2">Approaching your budget.</p>}
          </div>
        )}

        {!hasBudget && (
          <p className="text-xs text-[#8a8c94]">Set a budget when you edit this project to track spending against your checklist costs.</p>
        )}
      </div>
    </div>
  )
}
