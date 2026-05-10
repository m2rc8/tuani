'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'

interface PatientResult {
  id: string
  name: string | null
  phone: string
}

interface MinorResult {
  patient_id: string
  name: string
}

interface DentalRecordCreated {
  id: string
}

const INPUT_CLASS = 'bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full focus:outline-none focus:border-sky-500 placeholder-slate-600'
const LABEL_CLASS = 'text-xs text-slate-400 uppercase tracking-wide mb-1 block'
const BTN_GREEN   = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50'
const BTN_SKY     = 'bg-sky-700 hover:bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50'
const BTN_OUTLINE = 'border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors'

export default function DentalPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'adult' | 'minor'>('adult')

  // Adult
  const [phone,      setPhone]      = useState('')
  const [searching,  setSearching]  = useState(false)
  const [patient,    setPatient]    = useState<PatientResult | null>(null)
  const [searchErr,  setSearchErr]  = useState('')
  const [creating,   setCreating]   = useState(false)
  const [createErr,  setCreateErr]  = useState('')

  // Minor search
  const [minorQuery,   setMinorQuery]   = useState('')
  const [minorResults, setMinorResults] = useState<MinorResult[] | null>(null)
  const [searching2,   setSearching2]   = useState(false)

  // Minor create
  const [showCreate,    setShowCreate]    = useState(false)
  const [firstName,     setFirstName]     = useState('')
  const [lastName,      setLastName]      = useState('')
  const [dob,           setDob]           = useState('')
  const [guardianName,  setGuardianName]  = useState('')
  const [creatingMinor, setCreatingMinor] = useState(false)
  const [minorErr,      setMinorErr]      = useState('')

  async function handleAdultSearch(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = phone.trim()
    if (!cleaned) return
    setSearching(true); setSearchErr(''); setPatient(null); setCreateErr('')
    try {
      const data = await apiFetch<PatientResult>(`/api/patients/by-phone/${encodeURIComponent(cleaned)}`)
      setPatient(data)
    } catch { setSearchErr('Paciente no encontrado.') }
    finally { setSearching(false) }
  }

  async function handleStart(patientId: string) {
    setCreating(true); setCreateErr('')
    try {
      const record = await apiFetch<DentalRecordCreated>('/api/dental/records', {
        method: 'POST',
        body:   JSON.stringify({ patient_id: patientId }),
      })
      router.push(`/doctor/dental/${record.id}`)
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : 'Error al crear ficha dental.')
      setCreating(false)
    }
  }

  async function handleMinorSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!minorQuery.trim()) return
    setSearching2(true); setMinorResults(null)
    try {
      const data = await apiFetch<MinorResult[]>(`/api/dental/patients/minor/search?q=${encodeURIComponent(minorQuery.trim())}`)
      setMinorResults(data)
    } catch { setMinorResults([]) }
    finally { setSearching2(false) }
  }

  async function handleCreateMinor(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !dob) return
    setCreatingMinor(true); setMinorErr('')
    try {
      const data = await apiFetch<{ patient_id: string }>('/api/dental/patients/minor', {
        method: 'POST',
        body:   JSON.stringify({
          first_name:    firstName.trim(),
          last_name:     lastName.trim(),
          dob:           dob,
          guardian_name: guardianName.trim() || undefined,
        }),
      })
      await handleStart(data.patient_id)
    } catch (err) {
      setMinorErr(err instanceof Error ? err.message : 'Error al registrar menor.')
      setCreatingMinor(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ficha Dental</h1>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('adult')}
          className={mode === 'adult' ? BTN_GREEN : BTN_OUTLINE}
        >
          Adulto
        </button>
        <button
          onClick={() => { setMode('minor'); setShowCreate(false); setMinorResults(null) }}
          className={mode === 'minor' ? BTN_GREEN : BTN_OUTLINE}
        >
          Menor de edad
        </button>
      </div>

      {mode === 'adult' ? (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 max-w-md">
          <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">Buscar por teléfono</h2>
          <form onSubmit={handleAdultSearch} className="flex flex-col gap-3">
            <div>
              <label className={LABEL_CLASS}>Teléfono</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ej: +50412345678" className={INPUT_CLASS} />
            </div>
            <button type="submit" disabled={searching || !phone.trim()} className={BTN_GREEN}>
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
            {searchErr && <p className="text-red-400 text-sm">{searchErr}</p>}
          </form>

          {patient && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-sky-900 flex items-center justify-center text-sky-300 font-bold">
                  {(patient.name ?? patient.phone).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{patient.name ?? '—'}</p>
                  <p className="text-slate-400 text-xs">{patient.phone}</p>
                </div>
              </div>
              <button onClick={() => handleStart(patient.id)} disabled={creating} className={BTN_GREEN + ' w-full'}>
                {creating ? 'Creando ficha...' : 'Iniciar ficha dental'}
              </button>
              {createErr && <p className="text-red-400 text-sm mt-2">{createErr}</p>}
            </div>
          )}
        </div>
      ) : showCreate ? (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white text-sm">← Buscar</button>
            <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Registrar nuevo menor</h2>
          </div>
          <form onSubmit={handleCreateMinor} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Nombre *</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} className={INPUT_CLASS} required />
              </div>
              <div>
                <label className={LABEL_CLASS}>Apellido *</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} className={INPUT_CLASS} required />
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>Fecha de nacimiento *</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} max={new Date().toISOString().slice(0,10)} className={INPUT_CLASS} required />
            </div>
            <div>
              <label className={LABEL_CLASS}>Tutor (opcional)</label>
              <input value={guardianName} onChange={e => setGuardianName(e.target.value)} placeholder="Nombre del padre/madre/tutor" className={INPUT_CLASS} />
            </div>
            {minorErr && <p className="text-red-400 text-sm">{minorErr}</p>}
            <button type="submit" disabled={creatingMinor || !firstName.trim() || !lastName.trim() || !dob} className={BTN_GREEN}>
              {creatingMinor ? 'Registrando...' : 'Registrar e iniciar ficha'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 max-w-md">
          <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">Buscar menor por nombre</h2>
          <form onSubmit={handleMinorSearch} className="flex gap-2 mb-4">
            <input
              value={minorQuery}
              onChange={e => setMinorQuery(e.target.value)}
              placeholder="Nombre del paciente..."
              className={INPUT_CLASS}
            />
            <button type="submit" disabled={searching2 || !minorQuery.trim()} className={BTN_SKY + ' shrink-0'}>
              {searching2 ? '...' : 'Buscar'}
            </button>
          </form>

          {minorResults !== null && (
            minorResults.length === 0 ? (
              <p className="text-slate-500 text-sm mb-4">No se encontró ningún menor con ese nombre.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-4">
                {minorResults.map(r => (
                  <button
                    key={r.patient_id}
                    onClick={() => handleStart(r.patient_id)}
                    disabled={creating}
                    className="text-left bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 py-3 transition-colors"
                  >
                    <p className="text-white text-sm font-medium">{r.name}</p>
                  </button>
                ))}
              </div>
            )
          )}

          <button onClick={() => setShowCreate(true)} className={BTN_OUTLINE + ' w-full'}>
            + Registrar nuevo menor
          </button>
        </div>
      )}
    </div>
  )
}
