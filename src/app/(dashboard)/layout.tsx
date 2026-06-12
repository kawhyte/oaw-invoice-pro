import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavLinks } from '@/components/NavLinks'
import { NavDropdown } from '@/components/NavDropdown'

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
    <div className="min-h-screen bg-stone-50">
      <nav className="bg-emerald-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <span className="font-semibold text-emerald-100 text-sm tracking-tight">
                OAW Invoice Pro
              </span>
              <NavLinks />
            </div>
            <NavDropdown
              logoUrl={bizSettings?.logo_url ?? null}
              businessName={bizSettings?.business_name ?? null}
            />
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
