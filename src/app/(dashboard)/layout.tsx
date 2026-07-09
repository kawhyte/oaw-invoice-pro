import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavLinks } from '@/components/NavLinks'
import { NavDropdown } from '@/components/NavDropdown'
import { MobileNav } from '@/components/MobileNav'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { ToastProvider } from '@/components/ui/Toast'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: bizSettings } = await supabase
    .from('business_settings')
    .select('business_name, logo_url')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex">
      {/* Sidebar — desktop/tablet-landscape only */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#1a1c1e] fixed inset-y-0 left-0 z-30">
        <div className="px-4 py-5 border-b border-white/10">
          <Link href="/dashboard" className="text-white font-semibold text-sm tracking-wide">
            OW Studio
          </Link>
        </div>
        <nav className="flex-1 px-2 py-4">
          <NavLinks />
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <NavDropdown
            logoUrl={bizSettings?.logo_url ?? null}
            businessName={bizSettings?.business_name ?? null}
          />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden bg-[#1a1c1e] px-4 h-12 flex items-center justify-between sticky top-0 z-20">
          <Link href="/dashboard" className="text-white font-semibold text-sm tracking-wide">
            OW Studio
          </Link>
          <NavDropdown
            logoUrl={bizSettings?.logo_url ?? null}
            businessName={bizSettings?.business_name ?? null}
            align="down"
          />
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8">
          <ToastProvider><ConfirmProvider>{children}</ConfirmProvider></ToastProvider>
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
