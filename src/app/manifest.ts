import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OW Studio',
    short_name: 'OW Studio',
    description: 'Professional invoice and project management for contractors',
    // Opens on the cached OW Studio launch screen, which hands over to /dashboard.
    // id stays '/dashboard' so installed copies keep their identity.
    start_url: '/launch',
    id: '/dashboard',
    display: 'standalone',
    background_color: '#1a1c1e',
    theme_color: '#1a1c1e',
    // 'any' so drawings can be viewed in landscape.
    orientation: 'any',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
