'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, DraftingCompass, Users, ReceiptText } from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects',  label: 'Projects',  icon: DraftingCompass },
  { href: '/clients',   label: 'Clients',   icon: Users },
  { href: '/invoices',  label: 'Invoices',  icon: ReceiptText },
]

export function NavLinks() {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-0.5">
      {links.map(link => {
        const active = pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              active
                ? 'text-white bg-[#715a3e]/20 border-l-2 border-[#715a3e]'
                : 'text-[#9aa0a9] hover:text-white hover:bg-white/5'
            }`}
          >
            <link.icon size={18} strokeWidth={1.5} />
            <span>{link.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
