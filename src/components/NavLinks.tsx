'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/clients', label: 'Clients' },
  { href: '/projects', label: 'Projects' },
  { href: '/invoices', label: 'Invoices' },
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
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              active
                ? 'text-white bg-[#715a3e]/20 border-l-2 border-[#715a3e] font-medium'
                : 'text-[#9aa0a9] hover:text-white hover:bg-white/5'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </div>
  )
}
