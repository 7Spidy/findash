import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/context/AppContext'

export const metadata: Metadata = {
  title: 'SpendDash — Understand your money',
  description: 'Drop your bank statements. Get financial clarity instantly.',
  robots: 'noindex, nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:ital,wght@0,700;0,800;1,700;1,800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}
