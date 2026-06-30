import { Eye, EyeOff, Lock } from 'lucide-react'

// One consistent badge for "who can see this section/file" across the project
// page, so the owner never has to guess what reaches the client.
type Variant = 'shared' | 'gated' | 'private'

const VARIANTS: Record<Variant, { cls: string; Icon: typeof Eye; label: string }> = {
  shared:  { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: Eye,    label: 'Client can view' },
  gated:   { cls: 'text-amber-700 bg-amber-50 border-amber-200',       Icon: Lock,   label: 'Draft now · unlocks when paid' },
  private: { cls: 'text-gray-600 bg-gray-100 border-gray-200',         Icon: EyeOff, label: 'Private · only you' },
}

export function VisibilityBadge({ variant, label }: { variant: Variant; label?: string }) {
  const v = VARIANTS[variant]
  const Icon = v.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border whitespace-nowrap ${v.cls}`}>
      <Icon className="w-3 h-3 shrink-0" />
      {label ?? v.label}
    </span>
  )
}
