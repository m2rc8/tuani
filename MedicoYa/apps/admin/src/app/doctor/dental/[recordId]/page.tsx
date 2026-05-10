'use client'
import { useState, useEffect, use } from 'react'
import { apiFetch } from '../../../../lib/api'
import Odontogram from '../../../../components/Odontogram'
import SurfaceEditor from '../../../../components/SurfaceEditor'

// ─── Types ────────────────────────────────────────────────────────────────────
type ToothSurface = 'healthy' | 'caries' | 'filled' | 'missing' | 'crown' | 'indicated_extraction'
type SurfaceKey = 'surface_vestibular' | 'surface_palatal' | 'surface_mesial' | 'surface_distal' | 'surface_occlusal'

interface ToothRecord {
  id: string
  dental_record_id: string
  tooth_fdi: number
  surface_mesial: ToothSurface
  surface_distal: ToothSurface
  surface_occlusal: ToothSurface
  surface_vestibular: ToothSurface
  surface_palatal: ToothSurface
  notes?: string
}

interface DentalTreatment {
  id: string
  tooth_fdi?: number
  procedure: string
  status: string
  cost_lps?: number
  notes?: string
  materials?: string[]
  performed_at: string
  started_at?: string | null
  ended_at?: string | null
  before_image_url?: string | null
  after_image_url?: string | null
}

interface DentalRecord {
  id: string
  patient_id: string
  referral_to?: string | null
  treatment_plan?: string | null
  teeth: ToothRecord[]
  treatments: DentalTreatment[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const INPUT_CLASS = 'bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full focus:outline-none focus:border-sky-500 placeholder-slate-600'
const LABEL_CLASS = 'text-xs text-slate-400 uppercase tracking-wide mb-1 block'
const BTN_GREEN   = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50'
const BTN_SKY     = 'bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50'

function defaultTooth(recordId: string, fdi: number): ToothRecord {
  return {
    id:                '',
    dental_record_id:  recordId,
    tooth_fdi:         fdi,
    surface_mesial:    'healthy',
    surface_distal:    'healthy',
    surface_occlusal:  'healthy',
    surface_vestibular:'healthy',
    surface_palatal:   'healthy',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DentalRecordPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = use(params)

  const [record,        setRecord]        = useState<DentalRecord | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [loadErr,       setLoadErr]       = useState('')
  const [teethMap,      setTeethMap]      = useState<Map<number, ToothRecord>>(new Map())
  const [dirtyFdis,     setDirtyFdis]     = useState<Set<number>>(new Set())
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [saveMsg,       setSaveMsg]       = useState('')

  // Treatment plan
  const [treatmentPlan,  setTreatmentPlan]  = useState('')
  const [savingPlan,     setSavingPlan]     = useState(false)
  const [planMsg,        setPlanMsg]        = useState('')

  // Referral
  const [referralTo,   setReferralTo]   = useState('')
  const [savingRef,    setSavingRef]    = useState(false)
  const [refMsg,       setRefMsg]       = useState('')

  // Treatment form
  const [procedure,    setProcedure]    = useState('')
  const [txToothFdi,   setTxToothFdi]   = useState('')
  const [costLps,      setCostLps]      = useState('')
  const [txNotes,      setTxNotes]      = useState('')
  const [txMaterials,  setTxMaterials]  = useState('')
  const [txStartedAt,  setTxStartedAt]  = useState('')
  const [txEndedAt,    setTxEndedAt]    = useState('')
  const [addingTx,     setAddingTx]     = useState(false)
  const [txErr,        setTxErr]        = useState('')
  const [showTxForm,   setShowTxForm]   = useState(false)

  // ── Fetch record on mount
  useEffect(() => {
    if (!recordId) return
    setLoading(true)
    apiFetch<DentalRecord>(`/api/dental/records/${recordId}`)
      .then(data => {
        setRecord(data)
        setReferralTo(data.referral_to ?? '')
        setTreatmentPlan(data.treatment_plan ?? '')
        const m = new Map<number, ToothRecord>()
        for (const t of data.teeth) m.set(t.tooth_fdi, t)
        setTeethMap(m)
      })
      .catch(err => setLoadErr(err instanceof Error ? err.message : 'Error al cargar ficha.'))
      .finally(() => setLoading(false))
  }, [recordId])

  // ── Handle surface click
  function handleSurfaceClick(fdi: number, surface: SurfaceKey) {
    setTeethMap(prev => {
      const existing = prev.get(fdi) ?? defaultTooth(recordId, fdi)
      const updated  = { ...existing, [surface]: 'caries' as ToothSurface }
      const next     = new Map(prev)
      next.set(fdi, updated)
      return next
    })
    setDirtyFdis(prev => new Set(prev).add(fdi))
  }

  // ── Handle surface editor change
  function handleSurfaceChange(surface: SurfaceKey, state: ToothSurface) {
    if (selectedTooth === null) return
    const fdi = selectedTooth
    setTeethMap(prev => {
      const existing = prev.get(fdi) ?? defaultTooth(recordId, fdi)
      const updated  = { ...existing, [surface]: state }
      const next     = new Map(prev)
      next.set(fdi, updated)
      return next
    })
    setDirtyFdis(prev => new Set(prev).add(fdi))
  }

  // ── Save dirty teeth
  async function handleSave() {
    if (dirtyFdis.size === 0 || !record) return
    setSaving(true)
    setSaveMsg('')
    try {
      const payload = Array.from(dirtyFdis).map(fdi => {
        const t = teethMap.get(fdi) ?? defaultTooth(recordId, fdi)
        return {
          tooth_fdi:          t.tooth_fdi,
          surface_mesial:     t.surface_mesial,
          surface_distal:     t.surface_distal,
          surface_occlusal:   t.surface_occlusal,
          surface_vestibular: t.surface_vestibular,
          surface_palatal:    t.surface_palatal,
          notes:              t.notes,
        }
      })
      await apiFetch(`/api/dental/records/${record.id}/teeth`, {
        method: 'PUT',
        body:   JSON.stringify(payload),
      })
      setDirtyFdis(new Set())
      setSaveMsg('Odontograma guardado.')
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  // ── Save treatment plan
  async function handleSavePlan() {
    if (!record) return
    setSavingPlan(true); setPlanMsg('')
    try {
      await apiFetch(`/api/dental/records/${record.id}/treatment-plan`, {
        method: 'PATCH',
        body:   JSON.stringify({ treatment_plan: treatmentPlan.trim() || null }),
      })
      setRecord(prev => prev ? { ...prev, treatment_plan: treatmentPlan.trim() || null } : prev)
      setPlanMsg('Plan guardado.')
    } catch (err) {
      setPlanMsg(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSavingPlan(false)
    }
  }

  // ── Save referral
  async function handleSaveReferral() {
    if (!record) return
    setSavingRef(true)
    setRefMsg('')
    try {
      await apiFetch(`/api/dental/records/${record.id}/referral`, {
        method: 'PATCH',
        body:   JSON.stringify({ referral_to: referralTo.trim() || null }),
      })
      setRefMsg('Referencia guardada.')
    } catch (err) {
      setRefMsg(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSavingRef(false)
    }
  }

  // ── Add treatment
  async function handleAddTreatment(e: React.FormEvent) {
    e.preventDefault()
    if (!procedure.trim() || !record) return
    setAddingTx(true)
    setTxErr('')
    try {
      const mats = txMaterials.split(',').map(m => m.trim()).filter(Boolean)
      const body: Record<string, unknown> = { procedure: procedure.trim() }
      if (txToothFdi.trim()) body.tooth_fdi  = parseInt(txToothFdi, 10)
      if (costLps.trim())    body.cost_lps   = parseFloat(costLps)
      if (txNotes.trim())    body.notes      = txNotes.trim()
      if (mats.length > 0)   body.materials  = mats
      if (txStartedAt)       body.started_at = new Date(txStartedAt).toISOString()
      if (txEndedAt)         body.ended_at   = new Date(txEndedAt).toISOString()

      const newTx = await apiFetch<DentalTreatment>(`/api/dental/records/${record.id}/treatments`, {
        method: 'POST',
        body:   JSON.stringify(body),
      })
      setRecord(prev => prev ? { ...prev, treatments: [...prev.treatments, newTx] } : prev)
      setProcedure(''); setTxToothFdi(''); setCostLps(''); setTxNotes(''); setTxMaterials('')
      setTxStartedAt(''); setTxEndedAt('')
      setShowTxForm(false)
    } catch (err) {
      setTxErr(err instanceof Error ? err.message : 'Error al agregar tratamiento.')
    } finally {
      setAddingTx(false)
    }
  }

  // ── Upload before/after image
  async function handleImageUpload(tx: DentalTreatment, type: 'before' | 'after', file: File) {
    const { getToken } = await import('../../../lib/auth')
    const formData = new FormData()
    formData.append('image', file)
    formData.append('type', type)
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/dental/records/${record!.id}/treatments/${tx.id}/images`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body:    formData,
      }
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const updated: DentalTreatment = await res.json()
    setRecord(prev => prev ? {
      ...prev,
      treatments: prev.treatments.map(t => t.id === updated.id ? updated : t),
    } : prev)
  }

  // ── Render states
  if (loading) return <p className="text-slate-500 text-sm p-4">Cargando ficha dental...</p>
  if (loadErr) return <p className="text-red-400 text-sm p-4">{loadErr}</p>
  if (!record) return null

  const selectedRecord  = selectedTooth !== null ? (teethMap.get(selectedTooth) ?? defaultTooth(recordId, selectedTooth)) : null
  const teethArray      = Array.from(teethMap.values())

  const DEFAULT_SURFACES: Record<SurfaceKey, ToothSurface> = {
    surface_vestibular: 'healthy',
    surface_palatal:    'healthy',
    surface_mesial:     'healthy',
    surface_distal:     'healthy',
    surface_occlusal:   'healthy',
  }

  const currentSurfaces: Record<SurfaceKey, ToothSurface> = selectedRecord
    ? {
        surface_vestibular: selectedRecord.surface_vestibular,
        surface_palatal:    selectedRecord.surface_palatal,
        surface_mesial:     selectedRecord.surface_mesial,
        surface_distal:     selectedRecord.surface_distal,
        surface_occlusal:   selectedRecord.surface_occlusal,
      }
    : DEFAULT_SURFACES

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ficha Dental</h1>
        <div className="flex items-center gap-3">
          {dirtyFdis.size > 0 && (
            <span className="text-xs text-amber-400">{dirtyFdis.size} diente(s) sin guardar</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || dirtyFdis.size === 0}
            className={BTN_GREEN}
          >
            {saving ? 'Guardando...' : 'Guardar odontograma'}
          </button>
        </div>
      </div>
      {saveMsg && (
        <p className={`text-sm mb-4 ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
          {saveMsg}
        </p>
      )}

      {/* Main layout: odontogram + surface editor */}
      <div className="flex flex-col xl:flex-row gap-6 mb-8">
        {/* Left — Odontogram */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex-1 min-w-0 overflow-x-auto">
          <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">Odontograma</h2>
          <Odontogram
            teeth={teethArray}
            selectedTooth={selectedTooth}
            onSelectTooth={setSelectedTooth}
            onSurfaceClick={handleSurfaceClick}
          />
        </div>

        {/* Right — Surface editor */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 w-full xl:w-72 shrink-0">
          {selectedTooth !== null ? (
            <SurfaceEditor
              toothFdi={selectedTooth}
              surfaces={currentSurfaces}
              onChange={handleSurfaceChange}
            />
          ) : (
            <p className="text-slate-500 text-sm">Selecciona un diente para editar sus superficies.</p>
          )}
        </div>
      </div>

      {/* Treatment plan */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-6">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Plan de tratamiento</h2>
        <textarea
          value={treatmentPlan}
          onChange={e => setTreatmentPlan(e.target.value)}
          placeholder="Describe el plan de tratamiento general del paciente..."
          rows={4}
          className={INPUT_CLASS + ' resize-none'}
        />
        <div className="flex items-center gap-3 mt-2">
          <button onClick={handleSavePlan} disabled={savingPlan} className={BTN_GREEN}>
            {savingPlan ? 'Guardando...' : 'Guardar plan'}
          </button>
          {planMsg && (
            <span className={`text-xs ${planMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{planMsg}</span>
          )}
        </div>
      </div>

      {/* Referral section */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-6">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Referencia a especialista</h2>
        <div className="flex gap-3 items-end max-w-lg">
          <div className="flex-1">
            <input
              type="text"
              value={referralTo}
              onChange={e => setReferralTo(e.target.value)}
              placeholder="Ej: Ortodoncista, Cirujano maxilofacial..."
              className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full"
            />
          </div>
          <button onClick={handleSaveReferral} disabled={savingRef} className={BTN_GREEN}>
            {savingRef ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
        {refMsg && (
          <p className={`text-xs mt-2 ${refMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{refMsg}</p>
        )}
      </div>

      {/* Treatments section */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Tratamientos</h2>
          <button
            onClick={() => setShowTxForm(f => !f)}
            className={BTN_SKY}
          >
            {showTxForm ? 'Cancelar' : '+ Agregar tratamiento'}
          </button>
        </div>

        {/* Add treatment form */}
        {showTxForm && (
          <form onSubmit={handleAddTreatment} className="bg-slate-900 rounded-lg p-4 border border-slate-700 mb-4 flex flex-col gap-3 max-w-lg">
            <div>
              <label className={LABEL_CLASS}>Procedimiento *</label>
              <input
                value={procedure}
                onChange={e => setProcedure(e.target.value)}
                placeholder="Ej: Extracción, Obturación..."
                className={INPUT_CLASS}
                required
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={LABEL_CLASS}>Diente (FDI)</label>
                <input
                  type="number"
                  value={txToothFdi}
                  onChange={e => setTxToothFdi(e.target.value)}
                  placeholder="Ej: 21"
                  min={11}
                  max={48}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex-1">
                <label className={LABEL_CLASS}>Costo (Lps)</label>
                <input
                  type="number"
                  value={costLps}
                  onChange={e => setCostLps(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step="0.01"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <div>
              <label className={LABEL_CLASS}>Notas</label>
              <input
                value={txNotes}
                onChange={e => setTxNotes(e.target.value)}
                placeholder="Observaciones opcionales"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Materiales (separados por coma)</label>
              <input
                value={txMaterials}
                onChange={e => setTxMaterials(e.target.value)}
                placeholder="Ej: Amalgama, Resina compuesta..."
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={LABEL_CLASS}>Fecha/hora inicio</label>
                <input
                  type="datetime-local"
                  value={txStartedAt}
                  onChange={e => setTxStartedAt(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex-1">
                <label className={LABEL_CLASS}>Fecha/hora fin</label>
                <input
                  type="datetime-local"
                  value={txEndedAt}
                  onChange={e => setTxEndedAt(e.target.value)}
                  min={txStartedAt || undefined}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            {txErr && <p className="text-red-400 text-sm">{txErr}</p>}
            <button
              type="submit"
              disabled={addingTx || !procedure.trim()}
              className={BTN_GREEN + ' self-start'}
            >
              {addingTx ? 'Agregando...' : 'Agregar'}
            </button>
          </form>
        )}

        {/* Treatments list */}
        {record.treatments.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay tratamientos registrados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {record.treatments.map(tx => (
              <div
                key={tx.id}
                className="bg-slate-900 rounded-lg px-4 py-3 border border-slate-700 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">{tx.procedure}</span>
                    {tx.tooth_fdi && (
                      <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                        D-{tx.tooth_fdi}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      tx.status === 'completed' ? 'bg-green-900 text-green-300' :
                      tx.status === 'pending'   ? 'bg-yellow-900 text-yellow-300' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                  {tx.notes && <p className="text-slate-400 text-xs mt-0.5">{tx.notes}</p>}
                  {(tx.started_at || tx.ended_at) && (
                    <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                      {tx.started_at && <p>Inicio: {new Date(tx.started_at).toLocaleString('es-HN')}</p>}
                      {tx.ended_at   && <p>Fin: {new Date(tx.ended_at).toLocaleString('es-HN')}</p>}
                    </div>
                  )}
                  {tx.materials && tx.materials.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tx.materials.map((m, i) => (
                        <span key={i} className="text-xs bg-sky-900/50 text-sky-300 px-1.5 py-0.5 rounded">{m}</span>
                      ))}
                    </div>
                  )}
                  {(tx.before_image_url || tx.after_image_url) && (
                    <div className="flex gap-3 mt-2">
                      {tx.before_image_url && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Antes</p>
                          <a href={tx.before_image_url} target="_blank" rel="noreferrer">
                            <img src={tx.before_image_url} alt="antes" className="w-28 h-20 object-cover rounded" />
                          </a>
                        </div>
                      )}
                      {tx.after_image_url && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">Después</p>
                          <a href={tx.after_image_url} target="_blank" rel="noreferrer">
                            <img src={tx.after_image_url} alt="después" className="w-28 h-20 object-cover rounded" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Upload before/after images */}
                  <div className="flex gap-2 mt-2">
                    <label className="cursor-pointer text-xs text-sky-400 hover:text-sky-300">
                      {tx.before_image_url ? '↻ Antes' : '+ Antes'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleImageUpload(tx, 'before', e.target.files[0])}
                      />
                    </label>
                    <label className="cursor-pointer text-xs text-sky-400 hover:text-sky-300">
                      {tx.after_image_url ? '↻ Después' : '+ Después'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleImageUpload(tx, 'after', e.target.files[0])}
                      />
                    </label>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {tx.cost_lps !== undefined && (
                    <p className="text-white text-sm font-semibold">L {Number(tx.cost_lps).toFixed(2)}</p>
                  )}
                  <p className="text-slate-500 text-xs">
                    {new Date(tx.performed_at).toLocaleDateString('es-HN', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
