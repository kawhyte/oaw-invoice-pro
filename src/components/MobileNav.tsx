'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, DraftingCompass, ReceiptText, Users, Settings, LogOut, Menu } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const tabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/projects',  label: 'Projects', icon: DraftingCompass },
  { href: '/invoices',  label: 'Invoices', icon: ReceiptText },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#e0e0e3] flex lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 py-2 gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-[#715a3e]' : 'text-[#8a8c94]'
              }`}
            >
              <Icon size={22} strokeWidth={1.5} />
              <span>{label}</span>
            </Link>
          )
        })}

        <button
          onClick={() => setSheetOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-2 gap-1 text-xs font-medium transition-colors ${
            sheetOpen ? 'text-[#715a3e]' : 'text-[#8a8c94]'
          }`}
        >
          <Menu size={22} strokeWidth={1.5} />
          <span>More</span>
        </button>
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl shadow-xl w-full"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#e0e0e3]" />
            </div>

            <div className="px-4 py-2 space-y-1">
              <Link
                href="/clients"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-4 px-3 py-3.5 rounded-xl text-[#1a1c1e] hover:bg-[#f8f9fa] font-medium"
              >
                <Users size={20} strokeWidth={1.5} className="text-[#5a5c62]" />
                <span>Clients</span>
              </Link>
              <Link
                href="/settings"
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-4 px-3 py-3.5 rounded-xl text-[#1a1c1e] hover:bg-[#f8f9fa] font-medium"
              >
                <Settings size={20} strokeWidth={1.5} className="text-[#5a5c62]" />
                <span>Settings</span>
              </Link>
              <button
                onClick={async () => {
                  setSheetOpen(false)
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  router.push('/login')
                }}
                className="flex items-center gap-4 px-3 py-3.5 rounded-xl w-full text-left text-[#93000a] hover:bg-[#ffdad6]/30 font-medium"
              >
                <LogOut size={20} strokeWidth={1.5} />
                <span>Sign Out</span>
              </button>
            </div>

            <div className="h-4" />
          </div>
        </div>
      )}
    </>
  )
}
