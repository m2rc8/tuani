'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'
import { getRole } from '../../../lib/auth'

interface UserDetail {
  id:                 string
  phone:              string
  name:               string | null
  first_name:         string | null
  last_name:          string | null
  role:               string
  preferred_language: string
  created_at:         string
  consultation_count: number
  doctor?: {
    approved_at:  string | null
    rejected_at:  string | null
    available:    boolean
    cedula:       string | null
    bio:          string | null
    cmh_verified: boolean
  } | null
  patient?: {
    id:                string
    dob:               string | null
    allergies:         string | null
    registration_mode: string
  } | null
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

const INPUT_CLASS = 'bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full focus:outline-none focus:border-sky-500'

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()

  useEffect(() => {
    if (getRole() !== 'admin') router.replace('/')
  }, [router])

  const [user,    setUser]    = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // Edit state
  const [editName,  setEditName]  = useState('')
  const [editFname, setEditFname] = useState('')
  const [editLname, setEditLname] = useState('')
  const [editRole,  setEditRole]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState('')

  useEffect(() => {
    apiFetch<UserDetail>(`/api/admin/users/${id}`)
      .then(u => {
        setUser(u)
        setEditName(u.name ?? '')
        setEditFname(u.first_name ?? '')
        setEditLname(u.last_name ?? '')
        setEditRole(u.role)
      })
      .catch(() => setError('Usuario no encontrado.'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true); setSaveMsg('')
    try {
      const body: Record<string, string> = {}
      if (editName.trim()  !== (user.name  ?? '')) body.name       = editName.trim()
      if (editFname.trim() !== (user.first_name ?? '')) body.first_name = editFname.trim()
      if (editLname.trim() !== (user.last_name  ?? '')) body.last_name  = editLname.trim()
      if (editRole !== user.role) body.role = editRole

      if (Object.keys(body).length === 0) { setSaveMsg('Sin cambios.'); setSaving(false); return }

      const updated = await apiFetch<UserDetail>(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body:   JSON.stringify(body),
      })
      setUser(prev => prev ? { ...prev, ...updated } : prev)
      setSaveMsg('Guardado.')
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove() {
    if (!user?.doctor) return
    try {
      await apiFetch(`/api/admin/doctors/${id}/approve`, { method: 'PUT' })
      setUser(prev => prev ? { ...prev, doctor: { ...prev.doctor!, approved_at: new Date().toISOString(), rejected_at: null } } : prev)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  async function handleReject() {
    if (!user?.doctor) return
    if (!confirm('¿Rechazar este médico?')) return
    try {
      await apiFetch(`/api/admin/doctors/${id}/reject`, { method: 'PUT' })
      setUser(prev => prev ? { ...prev, doctor: { ...prev.doctor!, rejected_at: new Date().toISOString() } } : prev)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error')
    }
  }

  if (loading) return <p className="text-slate-500 text-sm p-4">Cargando...</p>
  if (error)   return <p className="text-red-400 text-sm p-4">{error}</p>
  if (!user)   return null

  const isMinor = user.phone.startsWith('DENTAL-')

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/users')} className="text-slate-400 hover:text-white text-sm transition-colors">← Usuarios</button>
        <h1 className="text-2xl font-bold">{user.name ?? 'Sin nombre'}</h1>
        <span className={`text-xs px-2 py-0.5 rounded ${ROLE_BADGE[user.role] ?? 'bg-slate-700 text-slate-400'}`}>
          {ROLE_LABEL[user.role] ?? user.role}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
          <p className="text-slate-400 text-xs mb-1">Consultas</p>
          <p className="text-white text-2xl font-bold">{user.consultation_count}</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
          <p className="text-slate-400 text-xs mb-1">Idioma</p>
          <p className="text-white text-lg font-bold uppercase">{user.preferred_language}</p>
        </div>
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
          <p className="text-slate-400 text-xs mb-1">Registro</p>
          <p className="text-white text-sm font-medium">
            {new Date(user.created_at).toLocaleDateString('es-HN', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Doctor info */}
      {user.doctor && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-6">
          <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Información médica</h2>
          <div className="flex flex-col gap-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-slate-400">Cédula</span>
              <span className="text-white">{user.doctor.cedula ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">CMH verificado</span>
              <span className={user.doctor.cmh_verified ? 'text-green-400' : 'text-slate-500'}>{user.doctor.cmh_verified ? 'Sí' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Disponible</span>
              <span className={user.doctor.available ? 'text-green-400' : 'text-slate-500'}>{user.doctor.available ? 'Sí' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Estado</span>
              <span>
                {user.doctor.rejected_at
                  ? <span className="text-red-400">Rechazado</span>
                  : user.doctor.approved_at
                    ? <span className="text-green-400">Aprobado {new Date(user.doctor.approved_at).toLocaleDateString()}</span>
                    : <span className="text-amber-400">Pendiente aprobación</span>}
              </span>
            </div>
            {user.doctor.bio && <p className="text-slate-400 text-xs mt-1">{user.doctor.bio}</p>}
          </div>
          {!user.doctor.approved_at && !user.doctor.rejected_at && (
            <div className="flex gap-2">
              <button onClick={handleApprove} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                Aprobar
              </button>
              <button onClick={handleReject} className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                Rechazar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Patient info */}
      {user.patient && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-6">
          <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Información del paciente</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Fecha de nacimiento</span>
              <span className="text-white">
                {user.patient.dob ? new Date(user.patient.dob).toLocaleDateString('es-HN') : '—'}
              </span>
            </div>
            {user.patient.allergies && (
              <div className="flex justify-between">
                <span className="text-slate-400">Alergias / Tutor</span>
                <span className="text-white text-right max-w-xs">{user.patient.allergies}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Registro</span>
              <span className="text-white">{user.patient.registration_mode}</span>
            </div>
          </div>
        </div>
      )}

      {/* Edit form */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">Editar usuario</h2>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Nombre</label>
              <input value={editFname} onChange={e => setEditFname(e.target.value)} placeholder="Nombre" className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Apellido</label>
              <input value={editLname} onChange={e => setEditLname(e.target.value)} placeholder="Apellido" className={INPUT_CLASS} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Nombre completo</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre completo" className={INPUT_CLASS} />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">
              Teléfono
            </label>
            <input
              value={isMinor ? 'Paciente menor (sin teléfono)' : user.phone}
              disabled
              className={INPUT_CLASS + ' opacity-50 cursor-not-allowed'}
            />
          </div>
          {!isMinor && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Rol</label>
              <select value={editRole} onChange={e => setEditRole(e.target.value)} className={INPUT_CLASS}>
                <option value="patient">Paciente</option>
                <option value="doctor">Médico</option>
                <option value="coordinator">Coordinador</option>
              </select>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {saveMsg && (
              <span className={`text-sm ${saveMsg === 'Guardado.' ? 'text-green-400' : 'text-amber-400'}`}>
                {saveMsg}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
