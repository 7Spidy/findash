import type { Metadata } from 'next'
import './globals.css'
import { AppProvider } from '@/context/AppContext'

export const metadata: Metadata = {
  title: 'FinDash — Personal Finance',
  description: 'Drop your bank statements. Get financial clarity instantly.',
  robots: 'noindex, nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased" style={{ fontFamily: "'Geist Sans', sans-serif" }}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}
