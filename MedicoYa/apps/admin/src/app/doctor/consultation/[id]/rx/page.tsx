'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiFetch } from '../../../../../lib/api'
import { getRole } from '../../../../../lib/auth'
import { useEffect } from 'react'

interface Medication {
  name:      string
  dose:      string
  frequency: string
}

const emptyMed = (): Medication => ({ name: '', dose: '', frequency: '' })

export default function RxPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  // Role guard
  useEffect(() => {
    if (getRole() !== 'doctor') router.replace('/')
  }, [router])

  const [diagnosis,     setDiagnosis]     = useState('')
  const [diagnosisCode, setDiagnosisCode] = useState('')
  const [instructions,  setInstructions]  = useState('')
  const [priceLps,      setPriceLps]      = useState<number | ''>('')
  const [referralTo,    setReferralTo]    = useState('')
  const [medications,   setMedications]   = useState<Medication[]>([emptyMed()])
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  function updateMed(index: number, field: keyof Medication, value: string) {
    setMedications(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function addMed() {
    setMedications(prev => [...prev, emptyMed()])
  }

  function removeMed(index: number) {
    setMedications(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!diagnosis.trim()) {
      setError('El diagnóstico es requerido.')
      return
    }
    setError(null)
    setSubmitting(true)

    // Filter out empty medication rows
    const filteredMeds = medications.filter(m => m.name.trim())

    try {
      await apiFetch(`/api/consultations/${id}/complete`, {
        method: 'PUT',
        body: JSON.stringify({
          diagnosis:      diagnosis.trim(),
          diagnosis_code: diagnosisCode.trim() || undefined,
          instructions:   instructions.trim()  || undefined,
          price_lps:      priceLps !== ''      ? Number(priceLps) : undefined,
          referral_to:    referralTo.trim()    || undefined,
          medications:    filteredMeds,
        }),
      })
      router.push(`/doctor/consultation/${id}`)
    } catch (e) {
      setError((e as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/doctor/consultation/${id}`)}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← Volver
        </button>
        <h1 className="text-2xl font-bold">Receta / Completar consulta</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Diagnosis */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Diagnóstico <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={diagnosis}
            onChange={e => setDiagnosis(e.target.value)}
            placeholder="Describe el diagnóstico del paciente..."
            className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full resize-none"
          />
        </div>

        {/* ICD-10 */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Código CIE-10 <span className="text-slate-500">(opcional)</span>
          </label>
          <input
            type="text"
            value={diagnosisCode}
            onChange={e => setDiagnosisCode(e.target.value)}
            placeholder="Ej: J06.9"
            className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full"
          />
        </div>

        {/* Referral */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Referir a especialista <span className="text-slate-500">(opcional)</span>
          </label>
          <input
            type="text"
            value={referralTo}
            onChange={e => setReferralTo(e.target.value)}
            placeholder="Ej: Cardiólogo, Dermatólogo, Ortopedista..."
            className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full"
          />
        </div>

        {/* Instructions */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Instrucciones / Indicaciones <span className="text-slate-500">(opcional)</span>
          </label>
          <textarea
            rows={3}
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Reposo, dieta, cuidados especiales..."
            className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full resize-none"
          />
        </div>

        {/* Price */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Costo de consulta (L.) <span className="text-slate-500">(opcional)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">L.</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={priceLps}
              onChange={e => setPriceLps(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full pl-8"
            />
          </div>
        </div>

        {/* Medications */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-300">
              Medicamentos <span className="text-slate-500">(opcional)</span>
            </label>
            <button
              type="button"
              onClick={addMed}
              className="px-3 py-1 rounded font-semibold text-xs transition-colors bg-slate-700 hover:bg-slate-600 text-slate-200"
            >
              + Agregar
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {medications.map((med, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={med.name}
                    onChange={e => updateMed(i, 'name', e.target.value)}
                    placeholder="Medicamento"
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full"
                  />
                  <input
                    type="text"
                    value={med.dose}
                    onChange={e => updateMed(i, 'dose', e.target.value)}
                    placeholder="Dosis"
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full"
                  />
                  <input
                    type="text"
                    value={med.frequency}
                    onChange={e => updateMed(i, 'frequency', e.target.value)}
                    placeholder="Frecuencia"
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-full"
                  />
                </div>
                {medications.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMed(i)}
                    className="text-red-500 hover:text-red-400 text-lg leading-none mt-2 transition-colors"
                    aria-label="Eliminar medicamento"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 w-full"
        >
          {submitting ? 'Guardando...' : 'Completar consulta'}
        </button>

      </form>
    </div>
  )
}
