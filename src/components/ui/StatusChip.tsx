const STATUS_STYLES = {
  draft:       { bg: '#e7e8e9', text: '#44474a', label: 'Draft' },
  sent:        { bg: '#d8e3fa', text: '#3c475a', label: 'Sent' },
  partial:     { bg: '#fdddb9', text: '#584329', label: 'Partial' },
  paid:        { bg: '#dde8dd', text: '#2a5130', label: 'Paid' },
  overdue:     { bg: '#ffdad6', text: '#93000a', label: 'Overdue' },
  discovery:   { bg: '#e7e8e9', text: '#44474a', label: 'Discovery' },
  in_progress: { bg: '#d8e3fa', text: '#3c475a', label: 'In Progress' },
  review:      { bg: '#fdddb9', text: '#584329', label: 'Review' },
  complete:    { bg: '#dde8dd', text: '#2a5130', label: 'Complete' },
  locked:      { bg: '#fdddb9', text: '#584329', label: 'Locked' },
  unlocked:    { bg: '#dde8dd', text: '#2a5130', label: 'Unlocked' },
}

export function StatusChip({ status }: { status: string }) {
  const style = STATUS_STYLES[status as keyof typeof STATUS_STYLES]
  if (!style) return null
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-medium label-caps whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  )
}
