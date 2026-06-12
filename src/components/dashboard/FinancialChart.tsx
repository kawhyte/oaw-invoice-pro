'use client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface CurrencyStats { currency: string; total: number; paid: number; owing: number }

const COLOR_MAP: Record<string, string> = {
  Paid: '#e0e0e3',
  Owing: '#715a3e',
}

export function FinancialChart({ stats }: { stats: CurrencyStats[] }) {
  const primary = stats[0]
  if (!primary || (primary.paid === 0 && primary.owing === 0)) {
    return (
      <div className="h-52 flex items-center justify-center">
        <p className="text-sm text-gray-400">No invoice data yet</p>
      </div>
    )
  }

  const data = [
    { name: 'Paid', value: primary.paid },
    { name: 'Owing', value: primary.owing },
  ].filter(d => d.value > 0)

  const owingStats = stats.filter(s => s.owing > 0)

  const fmt = (v: any) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: primary.currency, notation: 'compact', maximumFractionDigits: 1 }).format(v)

  return (
    <div className="space-y-4">
      {/* Donut chart with centered overlay label */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={90}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={COLOR_MAP[entry.name]} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip formatter={fmt} />
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="label-caps mb-1">Owing</p>
            {owingStats.length === 0 ? (
              <p className="data-mono text-sm text-[#1a1c1e]">—</p>
            ) : (
              owingStats.map(s => (
                <p key={s.currency} className="data-mono text-[13px] font-semibold text-[#715a3e] leading-tight">
                  {s.currency} {Number(s.owing).toLocaleString()}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Stats summary row */}
      <div className="px-2 pb-2 flex flex-wrap gap-x-6 gap-y-3">
        {stats.map(s => {
          const total = s.paid + s.owing
          const paidPct = total > 0 ? Math.round((s.paid / total) * 100) : 0
          const owingPct = 100 - paidPct
          return (
            <div key={s.currency} className="flex gap-6">
              <div>
                <p className="label-caps">Paid</p>
                <p className="data-mono text-sm text-[#1a1c1e]">
                  {s.currency} {Number(s.paid).toLocaleString()}
                  <span className="text-[#8a8c94] ml-1 text-xs">{paidPct}%</span>
                </p>
              </div>
              <div>
                <p className="label-caps">Owing</p>
                <p className="data-mono text-sm text-[#715a3e]">
                  {s.currency} {Number(s.owing).toLocaleString()}
                  <span className="text-[#8a8c94] ml-1 text-xs">{owingPct}%</span>
                </p>
              </div>
              <div>
                <p className="label-caps">Total</p>
                <p className="data-mono text-sm text-[#1a1c1e]">
                  {s.currency} {Number(total).toLocaleString()}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
