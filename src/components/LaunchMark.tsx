// The OW Studio wordmark shared by the launch screen and the reveal overlay
// that fades it out over the dashboard, so the hand-over lines up exactly.
export function LaunchMark({ animated = true }: { animated?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-serif text-[64px] leading-none font-bold tracking-tight text-[#f5ede4]">OW</span>
      <span className={`${animated ? 'launch-rule ' : ''}mt-5 block h-[3px] w-24 rounded-full bg-[#a88763]/30 overflow-hidden`} aria-hidden />
      <span className={`${animated ? 'launch-fade ' : ''}mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#f5ede4]/70`} aria-hidden>
        Studio
      </span>
    </div>
  )
}
