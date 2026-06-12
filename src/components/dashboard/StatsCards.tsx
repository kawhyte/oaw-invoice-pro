interface CurrencyStats { currency: string; total: number; paid: number; owing: number }

export function StatsCards({ stats, invoiceCount }: { stats: CurrencyStats[]; invoiceCount: number }) {
  const fmt = (n: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n)

  const statCards = [
    { label: 'Total Invoiced', values: stats.map(s => ({ value: s.total, currency: s.currency })), color: 'text-gray-900' },
    { label: 'Amount Paid', values: stats.map(s => ({ value: s.paid, currency: s.currency })), color: 'text-green-600' },
    { label: 'Amount Owing', values: stats.map(s => ({ value: s.owing, currency: s.currency })), color: 'text-amber-600' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map(card => (
        <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{card.label}</p>
          {card.values.length === 0 ? (
            <p className="text-xl font-bold text-gray-300">—</p>
          ) : (
            card.values.map(v => (
              <div key={v.currency} className="flex items-baseline gap-1.5">
                <p className={`text-xl font-bold ${card.color}`}>{fmt(v.value, v.currency)}</p>
                <span className="text-xs text-gray-400">{v.currency}</span>
              </div>
            ))
          )}
        </div>
      ))}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Total Invoices</p>
        <p className="text-xl font-bold text-gray-900">{invoiceCount}</p>
      </div>
    </div>
  )
}
