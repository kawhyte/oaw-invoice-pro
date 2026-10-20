/* eslint-disable @next/next/no-img-element -- must paint from the SW cache with no loader */
// The OW Studio mark shared by the launch screen and the reveal overlay.
// It draws the app icon at the same size and spot as the Android splash
// (300dp, centred on the whole screen), so the native splash hands over to
// this page with no jump. -8px: the splash centres on the full screen, this
// page on the area between the status bar and the (shorter) nav bar.
export function LaunchMark({ animated = true }: { animated?: boolean }) {
  return (
    <div className="relative h-[300px] w-[300px] -translate-y-2">
      <img src="/icons/icon-512.png" alt="" width={300} height={300} className="h-full w-full" />
      {/* Sits exactly on the icon's brown rule (40–60% across, ~64% down). */}
      {animated && <span className="launch-shimmer absolute left-[40.2%] top-[63.4%] h-[1.4%] w-[19.6%] rounded-full" aria-hidden />}
      <span
        className={`${animated ? 'launch-fade ' : ''}absolute inset-x-0 top-[71%] text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f5ede4]/70`}
        aria-hidden
      >
        Studio
      </span>
    </div>
  )
}
