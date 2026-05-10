'use client'
import { Suspense, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'
import { getRole, getToken } from '../../../lib/auth'

interface BrigadeDashboard {
  total:          number
  attended:       number
  waiting:        number
  active_doctors: number
}

interface BrigadeReport {
  brigade_name:         string
  community:            string
  start_date:           string | null
  end_date:             string | null
  patient_count:        number
  total_consultations:  number
  by_registration_mode: { self: number; brigade_doctor: number }
  top_diagnoses:        { diagnosis: string; count: number }[]
  top_medications:      { name: string; count: number }[]
}

export default function BrigadeDetailPage() {
  return (
    <Suspense fallback={<p className="text-slate-500 text-sm">Cargando...</p>}>
      <BrigadeDetail />
    </Suspense>
  )
}

function BrigadeDetail() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const id           = searchParams.get('id') ?? ''
  const tab          = searchParams.get('tab') ?? 'dashboard'

  useEffect(() => {
    if (getRole() !== 'coordinator') router.replace('/doctors')
  }, [router])

  const { data: dashboard, isLoading: loadingDash, isError: dashError } = useQuery<BrigadeDashboard>({
    queryKey: ['brigade', id, 'dashboard'],
    queryFn:  () => apiFetch(`/api/brigades/${id}/dashboard`),
    enabled:  !!id && tab === 'dashboard',
  })

  const { data: report, isLoading: loadingReport, isError: reportError } = useQuery<BrigadeReport>({
    queryKey: ['brigade', id, 'report'],
    queryFn:  () => apiFetch(`/api/brigades/${id}/report`),
    enabled:  !!id && tab === 'report',
  })

  function setTab(t: 'dashboard' | 'report') {
    router.push(`/brigades/detail?id=${id}&tab=${t}`)
  }

  async function downloadPdf() {
    const token = getToken()
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/brigades/${id}/report?format=pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-brigada-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {!id ? (
        <p className="text-red-400 text-sm p-4">ID de brigada no especificado.</p>
      ) : (
        <>
          <h1 className="text-2xl font-bold mb-6">🚑 Brigada</h1>

          {/* Tabs */}
          <div className="flex border-b border-slate-700 mb-6">
            {(['dashboard', 'report'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
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
            ) : dashError ? (
              <p className="text-red-400 text-sm">Error al cargar el dashboard.</p>
            ) : dashboard ? (
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <StatCard label="Total consultas"     value={dashboard.total}          color="text-white" />
                <StatCard label="Atendidas"           value={dashboard.attended}       color="text-green-400" />
                <StatCard label="En espera"           value={dashboard.waiting}        color="text-yellow-400" />
                <StatCard label="Médicos activos hoy" value={dashboard.active_doctors} color="text-sky-400" />
              </div>
            ) : null
          )}

          {/* Report tab */}
          {tab === 'report' && (
            loadingReport ? (
              <p className="text-slate-500 text-sm">Cargando...</p>
            ) : reportError ? (
              <p className="text-red-400 text-sm">Error al cargar el reporte.</p>
            ) : report ? (
              <div className="max-w-md flex flex-col gap-4">
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Pacientes registrados</p>
                  <p className="text-3xl font-bold text-white">{report.patient_count}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {report.by_registration_mode.brigade_doctor} brigada · {report.by_registration_mode.self} propio
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Total consultas: {report.total_consultations}
                  </p>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-sky-400 text-sm font-semibold mb-3">Top diagnósticos</p>
                  {report.top_diagnoses.length === 0 ? (
                    <p className="text-slate-500 text-sm">Sin diagnósticos aún.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {report.top_diagnoses.map((d, i) => (
                        <div key={d.diagnosis ?? i} className="flex justify-between text-sm">
                          <span className="text-slate-400">{d.diagnosis}</span>
                          <span className="text-white font-medium">{d.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-sky-400 text-sm font-semibold mb-3">Medicamentos más usados</p>
                  {report.top_medications.length === 0 ? (
                    <p className="text-slate-500 text-sm">Sin medicamentos aún.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {report.top_medications.map((m, i) => (
                        <div key={m.name ?? i} className="flex justify-between text-sm">
                          <span className="text-slate-400">{m.name}</span>
                          <span className="text-white font-medium">{m.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={downloadPdf}
                  className="bg-sky-600 hover:bg-sky-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors self-start"
                >
                  Descargar PDF
                </button>
              </div>
            ) : null
          )}
        </>
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
