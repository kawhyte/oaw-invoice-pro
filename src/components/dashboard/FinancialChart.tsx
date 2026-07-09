'use client'
import dynamic from 'next/dynamic'

interface CurrencyStats { currency: string; total: number; paid: number; owing: number }

// recharts is heavy; load it only when the dashboard actually renders the
// chart (same pattern as ProjectMap.tsx → ProjectMapClient).
const Chart = dynamic(
  () => import('./FinancialChartInner').then((m) => m.FinancialChartInner),
  { ssr: false, loading: () => <div className="h-[300px] bg-gray-100 animate-pulse rounded-lg" /> }
)

export function FinancialChart({ stats }: { stats: CurrencyStats[] }) {
  return <Chart stats={stats} />
}
