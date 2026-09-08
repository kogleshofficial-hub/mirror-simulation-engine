import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MIRROR — See what a decision changes.',
  description: 'MIRROR is a deterministic simulation engine that turns real-world scenarios into transparent, interactive what-if simulations.',
  keywords: ['MIRROR', 'simulation', 'what-if analysis', 'decision modeling', 'scenario planning', 'deterministic simulation'],
  verification: {
    google: 'LI6z3Avdq6RsVP2faZ6nlhcbRwvnMIdjJkrSBygvnZM',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
