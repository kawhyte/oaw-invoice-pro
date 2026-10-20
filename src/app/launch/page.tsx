import type { Metadata } from 'next'
import { LaunchRedirect } from './LaunchRedirect'

// The installed app's start page (manifest start_url). Static and cached by the
// service worker, so it paints instantly on every open — even offline — and
// carries the OW Studio splash into the app while the dashboard loads behind it.
export const dynamic = 'force-static'
export const metadata: Metadata = { title: 'OW Studio' }

export default function Launch() {
  return (
    <main className="fixed inset-0 z-50 grid place-items-center bg-[#1a1c1e]">
      <div className="flex flex-col items-center">
        <span className="font-serif text-[64px] leading-none font-bold tracking-tight text-[#f5ede4]">OW</span>
        <span className="launch-rule mt-5 block h-[3px] w-24 rounded-full bg-[#a88763]/30 overflow-hidden" aria-hidden />
        <span className="launch-fade mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f5ede4]/70" aria-hidden>
          Studio
        </span>
        <span className="sr-only" role="status">Loading OW Studio…</span>
      </div>
      <LaunchRedirect />
    </main>
  )
}
