'use client'
import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Brigade {
  id: string
  name: string
  community: string
  municipality?: string
  department?: string
  start_date: string
  end_date: string
  brigade_type: 'medical' | 'dental'
  status: 'active' | 'closed' | 'scheduled'
  is_organizer?: boolean
  join_code?: string
}

interface BrigadeFormData {
  name: string
  community: string
  municipality: string
  department: string
  start_date: string
  end_date: string
  brigade_type: 'medical' | 'dental'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const INPUT_CLASS = 'bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full focus:outline-none focus:border-sky-500 placeholder-slate-600'
const LABEL_CLASS = 'text-xs text-slate-400 uppercase tracking-wide mb-1 block'
const BTN_GREEN   = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50'
const BTN_SKY     = 'bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50'
const BTN_SLATE   = 'bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50'

const EMPTY_FORM: BrigadeFormData = {
  name:         '',
  community:    '',
  municipality: '',
  department:   '',
  start_date:   '',
  end_date:     '',
  brigade_type: 'medical',
}

function statusBadge(status: string) {
  if (status === 'active')    return 'bg-green-900 text-green-300'
  if (status === 'scheduled') return 'bg-sky-900 text-sky-300'
  return 'bg-slate-700 text-slate-400'
}

function statusLabel(status: string) {
  if (status === 'active')    return '● Activa'
  if (status === 'scheduled') return '● Programada'
  return '● Cerrada'
}

// ─── Brigade Form Component ───────────────────────────────────────────────────
interface BrigadeFormProps {
  initial?: BrigadeFormData
  onSubmit: (data: BrigadeFormData) => Promise<void>
  onCancel: () => void
  submitLabel: string
  pending: boolean
  error: string
}

function BrigadeForm({ initial = EMPTY_FORM, onSubmit, onCancel, submitLabel, pending, error }: BrigadeFormProps) {
  const [form, setForm] = useState<BrigadeFormData>(initial)

  function set(field: keyof BrigadeFormData, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>Nombre *</label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ej: Brigada Comunitaria"
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Comunidad *</label>
          <input
            value={form.community}
            onChange={e => set('community', e.target.value)}
            placeholder="Ej: El Paraíso"
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Municipio</label>
          <input
            value={form.municipality}
            onChange={e => set('municipality', e.target.value)}
            placeholder="Ej: Tegucigalpa"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Departamento</label>
          <input
            value={form.department}
            onChange={e => set('department', e.target.value)}
            placeholder="Ej: Francisco Morazán"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Inicio *</label>
          <input
            type="datetime-local"
            value={form.start_date}
            onChange={e => set('start_date', e.target.value)}
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Fin *</label>
          <input
            type="datetime-local"
            value={form.end_date}
            onChange={e => set('end_date', e.target.value)}
            className={INPUT_CLASS}
            required
          />
        </div>
      </div>

      {/* Brigade type toggle */}
      <div>
        <label className={LABEL_CLASS}>Tipo de brigada</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => set('brigade_type', 'medical')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              form.brigade_type === 'medical'
                ? 'bg-sky-900 text-sky-300 border-sky-600'
                : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-sky-600 hover:text-sky-400'
            }`}
          >
            Médica
          </button>
          <button
            type="button"
            onClick={() => set('brigade_type', 'dental')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              form.brigade_type === 'dental'
                ? 'bg-teal-900 text-teal-300 border-teal-600'
                : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-teal-600 hover:text-teal-400'
            }`}
          >
            Odontológica
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={BTN_GREEN}>
          {pending ? 'Guardando...' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={BTN_SLATE}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DoctorBrigadesPage() {
  const [brigades,      setBrigades]      = useState<Brigade[]>([])
  const [loading,       setLoading]       = useState(true)
  const [loadErr,       setLoadErr]       = useState('')
  const [showCreate,    setShowCreate]    = useState(false)
  const [editId,        setEditId]        = useState<string | null>(null)
  const [createPending, setCreatePending] = useState(false)
  const [createErr,     setCreateErr]     = useState('')
  const [editPending,   setEditPending]   = useState(false)
  const [editErr,       setEditErr]       = useState('')

  // Join by code
  const [joinCode,    setJoinCode]    = useState('')
  const [joinResult,  setJoinResult]  = useState<Brigade | null>(null)
  const [joinSearching, setJoinSearching] = useState(false)
  const [joinSearchErr, setJoinSearchErr] = useState('')
  const [joinPending, setJoinPending] = useState(false)
  const [joinMsg,     setJoinMsg]     = useState('')

  // Load brigades
  useEffect(() => {
    Promise.all([
      apiFetch<Brigade[]>('/api/brigades').catch(() => [] as Brigade[]),
      apiFetch<Brigade[]>('/api/brigades/coordinator').catch(() => [] as Brigade[]),
    ]).then(([all, coordinated]) => {
      // Merge: coordinated brigades get is_organizer=true
      const coordIds = new Set(coordinated.map(b => b.id))
      const merged   = [
        ...coordinated.map(b => ({ ...b, is_organizer: true })),
        ...all.filter(b => !coordIds.has(b.id)),
      ]
      setBrigades(merged)
    }).catch(err => {
      setLoadErr(err instanceof Error ? err.message : 'Error al cargar brigadas.')
    }).finally(() => setLoading(false))
  }, [])

  // Create
  async function handleCreate(data: BrigadeFormData) {
    setCreatePending(true)
    setCreateErr('')
    try {
      const body = {
        ...data,
        start_date:   new Date(data.start_date).toISOString(),
        end_date:     new Date(data.end_date).toISOString(),
        municipality: data.municipality || undefined,
        department:   data.department   || undefined,
      }
      const created = await apiFetch<Brigade>('/api/brigades', {
        method: 'POST',
        body:   JSON.stringify(body),
      })
      setBrigades(prev => [{ ...created, is_organizer: true }, ...prev])
      setShowCreate(false)
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : 'Error al crear brigada.')
    } finally {
      setCreatePending(false)
    }
  }

  // Edit
  async function handleEdit(data: BrigadeFormData) {
    if (!editId) return
    setEditPending(true)
    setEditErr('')
    try {
      const body = {
        ...data,
        start_date:   new Date(data.start_date).toISOString(),
        end_date:     new Date(data.end_date).toISOString(),
        municipality: data.municipality || undefined,
        department:   data.department   || undefined,
      }
      const updated = await apiFetch<Brigade>(`/api/brigades/${editId}`, {
        method: 'PUT',
        body:   JSON.stringify(body),
      })
      setBrigades(prev => prev.map(b => b.id === editId ? { ...updated, is_organizer: b.is_organizer } : b))
      setEditId(null)
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : 'Error al guardar cambios.')
    } finally {
      setEditPending(false)
    }
  }

  // Join by code — search
  async function handleJoinSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoinSearching(true)
    setJoinSearchErr('')
    setJoinResult(null)
    setJoinMsg('')
    try {
      const found = await apiFetch<Brigade>(`/api/brigades/by-code/${encodeURIComponent(joinCode.trim())}`)
      setJoinResult(found)
    } catch {
      setJoinSearchErr('Código no encontrado o inválido.')
    } finally {
      setJoinSearching(false)
    }
  }

  // Join confirm
  async function handleJoinConfirm() {
    if (!joinResult) return
    setJoinPending(true)
    setJoinMsg('')
    try {
      await apiFetch(`/api/brigades/${joinResult.id}/join`, {
        method: 'POST',
        body:   JSON.stringify({ join_code: joinCode.trim() }),
      })
      setBrigades(prev => {
        if (prev.some(b => b.id === joinResult.id)) return prev
        return [joinResult, ...prev]
      })
      setJoinResult(null)
      setJoinCode('')
      setJoinMsg('Te has unido a la brigada.')
    } catch (err) {
      setJoinMsg(err instanceof Error ? err.message : 'Error al unirse.')
    } finally {
      setJoinPending(false)
    }
  }

  const editingBrigade = editId ? brigades.find(b => b.id === editId) : undefined

  function toFormData(b: Brigade): BrigadeFormData {
    return {
      name:         b.name,
      community:    b.community,
      municipality: b.municipality ?? '',
      department:   b.department   ?? '',
      start_date:   b.start_date ? b.start_date.slice(0, 16) : '',
      end_date:     b.end_date   ? b.end_date.slice(0, 16)   : '',
      brigade_type: b.brigade_type,
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mis Brigadas</h1>
        <button
          onClick={() => { setShowCreate(f => !f); setEditId(null) }}
          className={BTN_GREEN}
        >
          {showCreate ? 'Cancelar' : '+ Nueva brigada'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-6">
          <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">Nueva brigada</h2>
          <BrigadeForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            submitLabel="Crear brigada"
            pending={createPending}
            error={createErr}
          />
        </div>
      )}

      {/* Brigade list */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Brigadas</h2>
        {loading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : loadErr ? (
          <p className="text-red-400 text-sm">{loadErr}</p>
        ) : brigades.length === 0 ? (
          <p className="text-slate-500 text-sm">No tienes brigadas aún. Usa el código de brigada para unirte.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {brigades.map(b => (
              <div key={b.id}>
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-white">{b.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          b.brigade_type === 'dental'
                            ? 'bg-teal-900 text-teal-300'
                            : 'bg-sky-900 text-sky-300'
                        }`}>
                          {b.brigade_type === 'dental' ? 'Odontológica' : 'Médica'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${statusBadge(b.status)}`}>
                          {statusLabel(b.status)}
                        </span>
                        {b.is_organizer && (
                          <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded">
                            Organizador
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-sm">{b.community}</p>
                      {(b.municipality || b.department) && (
                        <p className="text-slate-500 text-xs">
                          {[b.municipality, b.department].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {b.join_code && (
                        <p className="text-slate-500 text-xs mt-1">
                          Código: <span className="text-slate-300 font-mono">{b.join_code}</span>
                        </p>
                      )}
                    </div>
                    {b.is_organizer && editId !== b.id && (
                      <button
                        onClick={() => { setEditId(b.id); setShowCreate(false); setEditErr('') }}
                        className={BTN_SLATE + ' shrink-0'}
                      >
                        Editar
                      </button>
                    )}
                    {b.is_organizer && editId === b.id && (
                      <button
                        onClick={() => setEditId(null)}
                        className={BTN_SLATE + ' shrink-0'}
                      >
                        Cerrar
                      </button>
                    )}
                  </div>
                </div>

                {/* Edit form inline */}
                {editId === b.id && editingBrigade && (
                  <div className="bg-slate-800 rounded-b-lg border-x border-b border-slate-700 px-4 pb-4 -mt-1">
                    <div className="pt-4 border-t border-slate-700">
                      <h3 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Editar brigada</h3>
                      <BrigadeForm
                        initial={toFormData(editingBrigade)}
                        onSubmit={handleEdit}
                        onCancel={() => setEditId(null)}
                        submitLabel="Guardar cambios"
                        pending={editPending}
                        error={editErr}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Join by code */}
      <section className="bg-slate-800 rounded-lg p-4 border border-slate-700 max-w-md">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">Unirse a una brigada</h2>
        <form onSubmit={handleJoinSearch} className="flex gap-2 mb-3">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="Código de brigada"
            className={INPUT_CLASS}
          />
          <button
            type="submit"
            disabled={joinSearching || !joinCode.trim()}
            className={BTN_SKY + ' shrink-0'}
          >
            {joinSearching ? '...' : 'Buscar'}
          </button>
        </form>
        {joinSearchErr && <p className="text-red-400 text-sm mb-2">{joinSearchErr}</p>}
        {joinResult && (
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-600 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-white text-sm">{joinResult.name}</p>
              <p className="text-slate-400 text-xs">{joinResult.community}</p>
              <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                joinResult.brigade_type === 'dental'
                  ? 'bg-teal-900 text-teal-300'
                  : 'bg-sky-900 text-sky-300'
              }`}>
                {joinResult.brigade_type === 'dental' ? 'Odontológica' : 'Médica'}
              </span>
            </div>
            <button
              onClick={handleJoinConfirm}
              disabled={joinPending}
              className={BTN_GREEN + ' shrink-0'}
            >
              {joinPending ? 'Uniéndose...' : 'Confirmar'}
            </button>
          </div>
        )}
        {joinMsg && (
          <p className={`text-sm mt-2 ${joinMsg.startsWith('Error') || joinMsg.startsWith('Código') ? 'text-red-400' : 'text-green-400'}`}>
            {joinMsg}
          </p>
        )}
      </section>
    </div>
  )
}
