'use client'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

interface CUser { name: string | null; phone: string }
interface CPatient { id: string; user: CUser }
interface CDoctor  { id: string; user: CUser }
interface Consultation {
  id: string
  status: 'pending' | 'active' | 'completed' | 'rejected' | 'cancelled'
  created_at: string
  patient: CPatient
  doctor:  CDoctor | null
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-blue-900   text-blue-300',
  active:    'bg-yellow-900 text-yellow-300',
  completed: 'bg-green-900  text-green-300',
  rejected:  'bg-red-900    text-red-300',
  cancelled: 'bg-red-900    text-red-300',
}

export default function ConsultationsTable() {
  const today = new Date().toISOString().split('T')[0]

  const { data = [], isLoading, dataUpdatedAt } = useQuery<Consultation[]>({
    queryKey:        ['consultations', today],
    queryFn:         () => apiFetch(`/api/admin/consultations?date=${today}`),
    refetchInterval: 30_000,
  })

  const ago = dataUpdatedAt
    ? `hace ${Math.round((Date.now() - dataUpdatedAt) / 1000)}s`
    : '—'

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Consultas hoy</h1>
        <span className="text-slate-500 text-sm">↻ {ago}</span>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : data.length === 0 ? (
        <p className="text-slate-500">No hay consultas hoy.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-800">
                <th className="pb-3 pr-6 font-medium">Paciente</th>
                <th className="pb-3 pr-6 font-medium">Médico</th>
                <th className="pb-3 pr-6 font-medium">Estado</th>
                <th className="pb-3       font-medium">Hora</th>
              </tr>
            </thead>
            <tbody>
              {data.map(c => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                  <td className="py-3 pr-6">
                    {c.patient.user.name ?? c.patient.user.phone}
                  </td>
                  <td className="py-3 pr-6">
                    {c.doctor?.user.name ?? <span className="text-slate-500">—</span>}
                  </td>
                  <td className="py-3 pr-6">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[c.status] ?? ''}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400">
                    {new Date(c.created_at).toLocaleTimeString('es-HN', {
                      hour: '2-digit', minute: '2-digit',
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
