'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'

interface PatientResult {
  id: string
  name: string | null
  phone: string
}

interface DentalRecordCreated {
  id: string
}

const INPUT_CLASS = 'bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full focus:outline-none focus:border-sky-500 placeholder-slate-600'
const LABEL_CLASS = 'text-xs text-slate-400 uppercase tracking-wide mb-1 block'
const BTN_GREEN   = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50'

export default function DentalPage() {
  const router = useRouter()

  const [phone,      setPhone]      = useState('')
  const [searching,  setSearching]  = useState(false)
  const [patient,    setPatient]    = useState<PatientResult | null>(null)
  const [searchErr,  setSearchErr]  = useState('')
  const [creating,   setCreating]   = useState(false)
  const [createErr,  setCreateErr]  = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = phone.trim()
    if (!cleaned) return
    setSearching(true)
    setSearchErr('')
    setPatient(null)
    setCreateErr('')
    try {
      const data = await apiFetch<PatientResult>(`/api/patients/by-phone/${encodeURIComponent(cleaned)}`)
      setPatient(data)
    } catch (err) {
      setSearchErr('Paciente no encontrado.')
      console.error(err)
    } finally {
      setSearching(false)
    }
  }

  async function handleStart() {
    if (!patient) return
    setCreating(true)
    setCreateErr('')
    try {
      const record = await apiFetch<DentalRecordCreated>('/api/dental/records', {
        method: 'POST',
        body:   JSON.stringify({ patient_id: patient.id }),
      })
      router.push(`/doctor/dental/${record.id}`)
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : 'Error al crear ficha dental.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ficha Dental</h1>

      {/* Phone search */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 max-w-md mb-6">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">Buscar paciente</h2>
        <form onSubmit={handleSearch} className="flex flex-col gap-3">
          <div>
            <label className={LABEL_CLASS}>Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ej: +50412345678"
              className={INPUT_CLASS}
            />
          </div>
          <button
            type="submit"
            disabled={searching || !phone.trim()}
            className={BTN_GREEN}
          >
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
          {searchErr && (
            <p className="text-red-400 text-sm">{searchErr}</p>
          )}
        </form>
      </div>

      {/* Patient result */}
      {patient && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 max-w-md">
          <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Paciente encontrado</h2>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-sky-900 flex items-center justify-center shrink-0 text-sky-300 font-bold text-lg">
              {(patient.name ?? patient.phone).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-white">{patient.name ?? '—'}</p>
              <p className="text-slate-400 text-sm">{patient.phone}</p>
            </div>
          </div>
          <button
            onClick={handleStart}
            disabled={creating}
            className={BTN_GREEN + ' w-full'}
          >
            {creating ? 'Creando ficha...' : 'Iniciar ficha dental'}
          </button>
          {createErr && (
            <p className="text-red-400 text-sm mt-2">{createErr}</p>
          )}
        </div>
      )}
    </div>
  )
}
