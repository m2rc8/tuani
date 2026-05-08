'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getToken, getRole } from '../lib/auth'
import Providers from '../providers'
import Sidebar from '../components/Sidebar'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const token = getToken()
    if (!token && pathname !== '/') router.replace('/')
    if (token && pathname === '/') {
      const role = getRole()
      router.replace(role === 'coordinator' ? '/brigades' : '/doctors')
    }
  }, [pathname, router])

  const isLogin = pathname === '/'

  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-200 min-h-screen">
        <Providers>
          <div className="flex min-h-screen">
            {!isLogin && <Sidebar />}
            <main className="flex-1 p-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
