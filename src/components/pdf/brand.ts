import path from 'path'
import { Font } from '@react-pdf/renderer'

// Shared react-pdf brand: fonts (registered once) and the Atelier palette.
// Server-only — used by the invoice and proposal PDF documents.

// ── Brand fonts (server-only; InvoiceDocument renders in the nodejs PDF route) ──
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts')
export const SERIF = 'LibreCaslon'
export const SANS = 'Hanken'
export const MONO = 'JetBrainsMono'

Font.register({
  family: SERIF,
  fonts: [
    { src: path.join(FONT_DIR, 'LibreCaslonText-Regular.ttf') },
    { src: path.join(FONT_DIR, 'LibreCaslonText-Bold.ttf'), fontWeight: 'bold' },
    { src: path.join(FONT_DIR, 'LibreCaslonText-Italic.ttf'), fontStyle: 'italic' },
  ],
})
Font.register({
  family: SANS,
  fonts: [
    { src: path.join(FONT_DIR, 'HankenGrotesk-Regular.ttf') },
    { src: path.join(FONT_DIR, 'HankenGrotesk-SemiBold.ttf'), fontWeight: 600 },
  ],
})
Font.register({
  family: MONO,
  fonts: [
    { src: path.join(FONT_DIR, 'JetBrainsMono-Regular.ttf') },
    { src: path.join(FONT_DIR, 'JetBrainsMono-Medium.ttf'), fontWeight: 500 },
  ],
})
// Keep long descriptions from being hyphenated mid-word.
Font.registerHyphenationCallback(word => [word])

// ── Atelier palette ──
export const DARK = '#1a1c1e'        // charcoal — header band
export const BRONZE = '#715a3e'      // brand accent
export const BRONZE_TINT = '#f5ede4' // soft bronze — amount-owing band
export const LIME = '#f8f9fa'        // limestone — alt rows / section headers
export const W = '#ffffff'
export const MUT = '#6b7280'
export const LINE = '#e5e7eb'

