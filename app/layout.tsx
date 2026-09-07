import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MIRROR — Test the decision before reality does.',
  description: 'An interactive deterministic simulation engine for exploring real-world scenarios.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}