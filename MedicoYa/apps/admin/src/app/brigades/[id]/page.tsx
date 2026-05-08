'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'

interface BrigadeDashboard {
  total:          number
  attended:       number
  waiting:        number
  active_doctors: number
}

interface BrigadeReport {
  patient_count:        number
  by_registration_mode: { self: number; brigade_doctor: number }
  top_diagnoses:        { diagnosis: string; count: number }[]
}

export default function BrigadeDetailPage() {
  const { id }       = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const tab          = searchParams.get('tab') ?? 'dashboard'

  const { data: dashboard, isLoading: loadingDash } = useQuery<BrigadeDashboard>({
    queryKey: ['brigade', id, 'dashboard'],
    queryFn:  () => apiFetch(`/api/brigades/${id}/dashboard`),
    enabled:  tab === 'dashboard',
  })

  const { data: report, isLoading: loadingReport } = useQuery<BrigadeReport>({
    queryKey: ['brigade', id, 'report'],
    queryFn:  () => apiFetch(`/api/brigades/${id}/report`),
    enabled:  tab === 'report',
  })

  function setTab(t: 'dashboard' | 'report') {
    router.push(`/brigades/${id}?tab=${t}`)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🚑 Brigada</h1>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 mb-6">
        {(['dashboard', 'report'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
              tab === t
                ? 'text-sky-400 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'dashboard' ? 'Dashboard' : 'Reporte'}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && (
        loadingDash ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : dashboard ? (
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <StatCard label="Total consultas"    value={dashboard.total}          color="text-white" />
            <StatCard label="Atendidas"          value={dashboard.attended}       color="text-green-400" />
            <StatCard label="En espera"          value={dashboard.waiting}        color="text-yellow-400" />
            <StatCard label="Médicos activos hoy" value={dashboard.active_doctors} color="text-sky-400" />
          </div>
        ) : null
      )}

      {/* Report tab */}
      {tab === 'report' && (
        loadingReport ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : report ? (
          <div className="max-w-md flex flex-col gap-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Pacientes registrados</p>
              <p className="text-3xl font-bold text-white">{report.patient_count}</p>
              <p className="text-xs text-slate-500 mt-1">
                {report.by_registration_mode.brigade_doctor} brigada · {report.by_registration_mode.self} propio
              </p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-sky-400 text-sm font-semibold mb-3">Top diagnósticos</p>
              {report.top_diagnoses.length === 0 ? (
                <p className="text-slate-500 text-sm">Sin diagnósticos aún.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {report.top_diagnoses.map((d, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-400">{d.diagnosis}</span>
                      <span className="text-white font-medium">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900 rounded-lg p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-slate-400 text-xs mt-1">{label}</p>
    </div>
  )
}
