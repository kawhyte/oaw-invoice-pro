// Client-only share helpers. Android Chrome / the TWA support sharing files
// (PDF included) through the native share sheet; desktop browsers mostly don't,
// so every helper has a fallback.

/** Digits-only international number for wa.me, or null if unusable.
 *  Jamaica: 7-digit local → 1876XXXXXXX; 10-digit NANP (876/658/US) → 1XXXXXXXXXX;
 *  UK 07XXXXXXXXX → 447XXXXXXXXX; anything already starting with a country code is kept. */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  const raw = phone.trim()
  let d = raw.replace(/\D/g, '')
  if (!d) return null
  if (raw.startsWith('+')) return d.length >= 8 ? d : null
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 7) return `1876${d}`
  if (d.length === 10 && !d.startsWith('0')) return `1${d}`
  if (d.length === 11 && d.startsWith('07')) return `44${d.slice(1)}`
  return d.length >= 8 ? d : null
}

export function whatsAppUrl(text: string, phone?: string | null): string {
  const n = toWhatsAppNumber(phone)
  return `https://wa.me/${n ?? ''}?text=${encodeURIComponent(text)}`
}

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false
  const probe = new File([new Blob(['x'], { type: 'application/pdf' })], 'x.pdf', { type: 'application/pdf' })
  return navigator.canShare({ files: [probe] })
}

/** 'shared' | 'cancelled' | 'needs-gesture' (transient activation expired while
 *  the file was being fetched — caller should ask for a second tap). */
export async function shareFile(file: File, title: string, text: string): Promise<'shared' | 'cancelled' | 'needs-gesture'> {
  try {
    await navigator.share({ files: [file], title, text })
    return 'shared'
  } catch (err) {
    const name = (err as DOMException)?.name
    if (name === 'AbortError') return 'cancelled'
    if (name === 'NotAllowedError') return 'needs-gesture'
    throw err
  }
}

/** Shares a URL via the share sheet; falls back to clipboard. Returns 'copied' on fallback. */
export async function shareLink(url: string, title: string, text: string): Promise<'shared' | 'cancelled' | 'copied'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ url, title, text }); return 'shared' }
    catch (err) { if ((err as DOMException)?.name === 'AbortError') return 'cancelled' }
  }
  await navigator.clipboard.writeText(url)
  return 'copied'
}
