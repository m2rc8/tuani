'use client'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { getRole } from '../../lib/auth'

interface CUser   { name: string | null; phone: string }
interface CPatient { user: CUser }
interface Consultation {
  id:            string
  status:        'pending' | 'active' | 'completed'
  created_at:    string
  symptoms_text: string | null
  patient:       CPatient
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-yellow-900 text-yellow-300',
  active:    'bg-blue-900   text-blue-300',
  completed: 'bg-green-900  text-green-300',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pendiente',
  active:    'Activa',
  completed: 'Completada',
}

export default function MyConsultationsPage() {
  const router = useRouter()

  useEffect(() => {
    if (getRole() !== 'doctor') router.replace('/')
  }, [router])

  const { data = [], isLoading, isError } = useQuery<Consultation[]>({
    queryKey:        ['my-consultations'],
    queryFn:         () => apiFetch('/api/consultations/my'),
    refetchInterval: 30_000,
  })

  const today = new Date().toISOString().split('T')[0]
  const completedToday = data.filter(c =>
    c.status === 'completed' && c.created_at.startsWith(today)
  ).length

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Mis consultas</h1>
        <div className="bg-slate-900 rounded-lg px-4 py-2 text-sm">
          <span className="text-slate-400">Completadas hoy: </span>
          <span className="text-green-400 font-bold">{completedToday}</span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-500 text-sm">Cargando...</p>
      ) : isError ? (
        <p className="text-red-400 text-sm">Error al cargar las consultas.</p>
      ) : data.length === 0 ? (
        <p className="text-slate-500 text-sm">No tienes consultas aún.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-800">
                <th className="pb-3 pr-6 font-medium">Paciente</th>
                <th className="pb-3 pr-6 font-medium">Síntomas</th>
                <th className="pb-3 pr-6 font-medium">Estado</th>
                <th className="pb-3       font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.map(c => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                  <td className="py-3 pr-6">
                    <p className="text-white">{c.patient?.user?.name ?? '—'}</p>
                    <p className="text-slate-500 text-xs">{c.patient?.user?.phone ?? '—'}</p>
                  </td>
                  <td className="py-3 pr-6 text-slate-400 max-w-xs">
                    {c.symptoms_text
                      ? c.symptoms_text.slice(0, 60) + (c.symptoms_text.length > 60 ? '…' : '')
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-3 pr-6">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[c.status] ?? ''}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400">
                    {new Date(c.created_at).toLocaleDateString('es-HN', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
