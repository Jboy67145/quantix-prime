import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import './scroll-fixes.css'
import './quantix-design-system.css'

export const metadata: Metadata = {
  title: 'Quantix Prime | Build with clarity',
  description: 'A premium Quantix Prime mobile experience for investing, community, and support.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef4f3' },
    { media: '(prefers-color-scheme: dark)', color: '#07151d' },
  ],
  viewportFit: 'cover',
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
