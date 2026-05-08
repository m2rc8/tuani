'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearToken, getRole } from '../lib/auth'

const ADMIN_NAV = [
  { href: '/doctors',       label: 'Médicos' },
  { href: '/consultations', label: 'Consultas' },
]

const COORDINATOR_NAV = [
  { href: '/brigades', label: '🚑 Brigadas' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const role     = getRole()
  const nav      = role === 'coordinator' ? COORDINATOR_NAV : ADMIN_NAV

  function logout() {
    clearToken()
    router.replace('/')
  }

  return (
    <aside className="w-48 min-h-screen bg-slate-900 flex flex-col p-4 shrink-0">
      <div className="text-sky-400 font-bold text-sm mb-6">MédicoYa Admin</div>
      <nav className="flex flex-col gap-1 flex-1">
        {nav.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2 rounded text-sm transition-colors ${
              pathname.startsWith(href)
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={logout}
        className="text-slate-500 text-xs px-3 py-2 hover:text-white text-left transition-colors"
      >
        Cerrar sesión
      </button>
    </aside>
  )
}
