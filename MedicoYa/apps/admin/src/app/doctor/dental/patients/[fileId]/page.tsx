'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../../../../lib/api'
import Odontogram from '../../../../../components/Odontogram'

type ToothSurface = 'healthy' | 'caries' | 'filled' | 'missing' | 'crown' | 'indicated_extraction'

interface ToothRecord {
  id: string; file_id: string; tooth_fdi: number
  surface_mesial: ToothSurface; surface_distal: ToothSurface
  surface_occlusal: ToothSurface; surface_vestibular: ToothSurface; surface_palatal: ToothSurface
  notes?: string
}

interface DentalVisit {
  id: string; file_id: string; dentist_id: string; brigade_id?: string
  visit_date: string; hygiene_notes?: string | null; cpod_index?: number | null
  treatment_plan?: string | null; referral_to?: string | null
  treatments: { id: string }[]
  dentist?: { name?: string | null; first_name?: string | null; last_name?: string | null }
}

interface DentalPatientFile {
  id: string; patient_id: string; created_at: string
  teeth: ToothRecord[]
  visits: DentalVisit[]
}

function dentistLabel(v: DentalVisit): string {
  const d = v.dentist
  if (!d) return '—'
  if (d.first_name && d.last_name) return `${d.first_name} ${d.last_name}`
  return d.name ?? '—'
}

const BTN_GREEN = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50'

export default function DentalExpedientePage({ params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = use(params)
  const router     = useRouter()

  const [file,      setFile]      = useState<DentalPatientFile | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [loadErr,   setLoadErr]   = useState('')
  const [creating,  setCreating]  = useState(false)
  const [createErr, setCreateErr] = useState('')

  useEffect(() => {
    apiFetch<DentalPatientFile>(`/api/dental/files/${fileId}`)
      .then(setFile)
      .catch(err => setLoadErr(err instanceof Error ? err.message : 'Error al cargar expediente.'))
      .finally(() => setLoading(false))
  }, [fileId])

  async function handleNewVisit() {
    setCreating(true); setCreateErr('')
    try {
      const visit = await apiFetch<{ id: string }>(`/api/dental/files/${fileId}/visits`, {
        method: 'POST',
        body:   JSON.stringify({}),
      })
      router.push(`/doctor/dental/visits/${visit.id}`)
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : 'Error al crear visita.')
      setCreating(false)
    }
  }

  if (loading) return <p className="text-slate-500 text-sm p-4">Cargando expediente...</p>
  if (loadErr) return <p className="text-red-400 text-sm p-4">{loadErr}</p>
  if (!file)   return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Expediente Dental</h1>
        <button onClick={handleNewVisit} disabled={creating} className={BTN_GREEN}>
          {creating ? 'Creando...' : '+ Nueva visita'}
        </button>
      </div>
      {createErr && <p className="text-red-400 text-sm mb-4">{createErr}</p>}

      {/* Cumulative odontogram */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-6 overflow-x-auto">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">Odontograma acumulativo</h2>
        <Odontogram
          teeth={file.teeth}
          selectedTooth={null}
          onSelectTooth={() => {}}
          onSurfaceClick={() => {}}
        />
      </div>

      {/* Visit history */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">
          Visitas ({file.visits.length})
        </h2>
        {file.visits.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin visitas registradas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {file.visits.map(v => (
              <button
                key={v.id}
                onClick={() => router.push(`/doctor/dental/visits/${v.id}`)}
                className="text-left bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 py-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium">
                    {new Date(v.visit_date).toLocaleDateString('es-HN', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </span>
                  <span className="text-slate-400 text-xs">{v.treatments.length} tratamiento(s)</span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">{dentistLabel(v)}</p>
                {v.treatment_plan && (
                  <p className="text-slate-500 text-xs mt-1 truncate">{v.treatment_plan}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
