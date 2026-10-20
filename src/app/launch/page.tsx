import type { Metadata } from 'next'
import { LaunchMark } from '@/components/LaunchMark'
import { LaunchRedirect } from './LaunchRedirect'

// The installed app's start page (manifest start_url). Static and cached by the
// service worker, so it paints instantly on every open — even offline — and
// carries the OW Studio splash into the app while the dashboard loads behind it.
export const dynamic = 'force-static'
export const metadata: Metadata = { title: 'OW Studio' }

export default function Launch() {
  return (
    <main className="fixed inset-0 z-50 grid place-items-center bg-[#1a1c1e]">
      <LaunchMark />
      <span className="sr-only" role="status">Loading OW Studio…</span>
      <LaunchRedirect />
    </main>
  )
}
