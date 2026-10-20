import { Suspense } from 'react'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { requireUserPage } from '@/lib/session'
import { NavIdentity } from '@/components/NavIdentity'
import { NavLinks } from '@/components/NavLinks'
import { NavDropdown } from '@/components/NavDropdown'
import { MobileNav } from '@/components/MobileNav'
import { LaunchReveal } from '@/components/LaunchReveal'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { ToastProvider } from '@/components/ui/Toast'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // The only thing that must finish before the shell renders: is he signed in?
  // Logo/name stream in via <NavIdentity>, so the page skeleton paints sooner.
  await requireUserPage()
  // Set by the launch screen: draw it over this first paint, then fade it out.
  const fromLaunch = (await cookies()).get('ow_launch')?.value === '1'

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
          <Suspense fallback={<NavDropdown logoUrl={null} businessName={null} />}>
            <NavIdentity />
          </Suspense>
        </div>
      </aside>

      {/* Main content */}
      {/* min-w-0: a flex child otherwise can't shrink below its content's width,
          so one wide element (table, long truncated title) widened the whole page. */}
      <div className="flex-1 min-w-0 lg:ml-56 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden bg-[#1a1c1e] px-4 h-12 flex items-center justify-between sticky top-0 z-20">
          <Link href="/dashboard" className="text-white font-semibold text-sm tracking-wide">
            OW Studio
          </Link>
          <Suspense fallback={<NavDropdown logoUrl={null} businessName={null} align="down" />}>
            <NavIdentity align="down" />
          </Suspense>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8">
          <ToastProvider><ConfirmProvider>{children}</ConfirmProvider></ToastProvider>
        </main>
      </div>

      <MobileNav />
      <LaunchReveal active={fromLaunch} />
    </div>
  )
}
