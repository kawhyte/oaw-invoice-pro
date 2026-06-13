import type { Metadata, Viewport } from 'next'
import { Libre_Caslon_Text, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

const libreCalson = Libre_Caslon_Text({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})
const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'OW Studio',
  description: 'Professional invoice and project management for contractors',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OW Studio',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#1a1c1e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${libreCalson.variable} ${hankenGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  )
}
