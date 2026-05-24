import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinDash — Personal Finance",
  description: "Your personal financial dashboard",
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
