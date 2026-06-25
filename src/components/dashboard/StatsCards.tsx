interface MoneyByCurrency { currency: string; value: number }

interface Props {
  owedByCurrency: { currency: string; owing: number }[]
  overdue: { count: number; owingByCurrency: { currency: string; owing: number }[] }
  invoiced30ByCurrency: { currency: string; total: number }[]
  activeProjects: number
}

export function StatsCards({ owedByCurrency, overdue, invoiced30ByCurrency, activeProjects }: Props) {
  const fmt = (n: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n)

  // Money cards: each renders one line per currency (JMD/USD never get summed).
  const moneyCards: { label: string; values: MoneyByCurrency[]; color: string }[] = [
    {
      label: 'Owed to You',
      values: owedByCurrency.map(c => ({ currency: c.currency, value: c.owing })),
      color: 'text-amber-600',
    },
    {
      label: 'Overdue',
      values: overdue.count === 0 ? [] : overdue.owingByCurrency.map(c => ({ currency: c.currency, value: c.owing })),
      color: 'text-[#93000a]',
    },
    {
      label: 'Invoiced · 30 Days',
      values: invoiced30ByCurrency.map(c => ({ currency: c.currency, value: c.total })),
      color: 'text-gray-900',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {moneyCards.map(card => (
        <div key={card.label} className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-5">
          <p className="label-caps mb-2">{card.label}</p>
          {card.values.length === 0 ? (
            <p className="text-xl font-bold text-gray-300">—</p>
          ) : (
            card.values.map(v => (
              <div key={v.currency}>
                <p className={`text-xl font-bold data-mono ${card.color}`}>{fmt(v.value, v.currency)}</p>
              </div>
            ))
          )}
        </div>
      ))}
      <div className="bg-white rounded-xl border border-[#e0e0e3] shadow-card p-5">
        <p className="label-caps mb-2">Active Projects</p>
        <p className={`text-xl font-bold data-mono ${activeProjects === 0 ? 'text-gray-300' : 'text-gray-900'}`}>
          {activeProjects === 0 ? '—' : activeProjects}
        </p>
      </div>
    </div>
  )
}
