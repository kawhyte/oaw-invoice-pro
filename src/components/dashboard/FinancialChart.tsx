'use client'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface CurrencyStats { currency: string; paid: number; owing: number }

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

  const COLORS = ['#22c55e', '#f59e0b']
  const fmt = (v: any) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: primary.currency, notation: 'compact', maximumFractionDigits: 1 }).format(v)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={65} outerRadius={85} dataKey="value" paddingAngle={3}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
        </Pie>
        <Tooltip formatter={fmt} />
        <Legend iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  )
}
