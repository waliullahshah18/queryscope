import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'QueryScope — Keyword discovery',
  description: 'Google Autocomplete keyword discovery through Microlink.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
