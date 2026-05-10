'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { getRole } from '../../lib/auth'

interface UserListItem {
  id:         string
  phone:      string
  name:       string | null
  role:       'patient' | 'doctor' | 'admin' | 'coordinator'
  created_at: string
  doctor?:    { approved_at: string | null; rejected_at: string | null } | null
}

interface UsersResponse {
  users: UserListItem[]
  total: number
  page:  number
  limit: number
}

const ROLE_BADGE: Record<string, string> = {
  patient:     'bg-slate-700 text-slate-300',
  doctor:      'bg-sky-900 text-sky-300',
  admin:       'bg-purple-900 text-purple-300',
  coordinator: 'bg-teal-900 text-teal-300',
}

const ROLE_LABEL: Record<string, string> = {
  patient:     'Paciente',
  doctor:      'Médico',
  admin:       'Admin',
  coordinator: 'Coordinador',
}

const ROLES = ['', 'patient', 'doctor', 'admin', 'coordinator']

export default function UsersPage() {
  const router = useRouter()

  useEffect(() => {
    if (getRole() !== 'admin') router.replace('/')
  }, [router])

  const [q,       setQ]       = useState('')
  const [role,    setRole]    = useState('')
  const [page,    setPage]    = useState(1)
  const [data,    setData]    = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchUsers = useCallback(async (qVal: string, roleVal: string, pageVal: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pageVal), limit: '50' })
      if (qVal.trim())    params.set('q',    qVal.trim())
      if (roleVal.trim()) params.set('role', roleVal.trim())
      const res = await apiFetch<UsersResponse>(`/api/admin/users?${params}`)
      setData(res)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUsers(q, role, page) }, [fetchUsers, q, role, page])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchUsers(q, role, 1)
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        {data && (
          <span className="text-slate-400 text-sm">{data.total} en total</span>
        )}
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
          placeholder="Buscar por nombre o teléfono..."
          className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-72 focus:outline-none focus:border-sky-500 placeholder-slate-600"
        />
        <select
          value={role}
          onChange={e => { setRole(e.target.value); setPage(1) }}
          className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
        >
          <option value="">Todos los roles</option>
          {ROLES.filter(Boolean).map(r => (
            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
      </form>

      {/* Table */}
      {loading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : !data || data.users.length === 0 ? (
        <p className="text-slate-500 text-sm">No se encontraron usuarios.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr className="text-slate-400 text-left">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Registro</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.users.map(u => {
                  const doctorStatus = u.doctor
                    ? u.doctor.rejected_at  ? <span className="text-xs text-red-400">Rechazado</span>
                    : u.doctor.approved_at  ? <span className="text-xs text-green-400">Aprobado</span>
                    : <span className="text-xs text-amber-400">Pendiente</span>
                    : null
                  return (
                    <tr key={u.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                      <td className="px-4 py-3 text-white font-medium">
                        {u.name ?? <span className="text-slate-500">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                        {u.phone.startsWith('DENTAL-') ? <span className="text-slate-600 italic">menor (dental)</span> : u.phone}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${ROLE_BADGE[u.role] ?? 'bg-slate-700 text-slate-400'}`}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">{doctorStatus}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('es-HN', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => router.push(`/users/${u.id}`)}
                          className="text-sky-400 hover:text-sky-300 text-xs transition-colors"
                        >
                          Ver →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3 mt-4 text-sm">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-slate-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
