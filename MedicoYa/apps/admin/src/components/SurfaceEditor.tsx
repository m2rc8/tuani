'use client'

// ─── Types ────────────────────────────────────────────────────────────────────
type ToothSurface = 'healthy' | 'caries' | 'filled' | 'missing' | 'crown' | 'indicated_extraction'
type SurfaceKey = 'surface_vestibular' | 'surface_palatal' | 'surface_mesial' | 'surface_distal' | 'surface_occlusal'

interface SurfaceEditorProps {
  toothFdi: number
  surfaces: Record<SurfaceKey, ToothSurface>
  onChange: (surface: SurfaceKey, state: ToothSurface) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SURFACE_KEYS: { key: SurfaceKey; label: string }[] = [
  { key: 'surface_vestibular', label: 'Vestibular' },
  { key: 'surface_palatal',    label: 'Palatino'   },
  { key: 'surface_mesial',     label: 'Mesial'     },
  { key: 'surface_distal',     label: 'Distal'     },
  { key: 'surface_occlusal',   label: 'Oclusal'    },
]

const SURFACE_STATES: {
  state: ToothSurface
  label: string
  activeClass: string
  inactiveClass: string
}[] = [
  {
    state:       'healthy',
    label:       'Sano',
    activeClass: 'bg-slate-500 text-white border-slate-400',
    inactiveClass:'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-300',
  },
  {
    state:       'caries',
    label:       'Caries',
    activeClass: 'bg-red-500 text-white border-red-400',
    inactiveClass:'border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400',
  },
  {
    state:       'filled',
    label:       'Obturado',
    activeClass: 'bg-blue-500 text-white border-blue-400',
    inactiveClass:'border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400',
  },
  {
    state:       'missing',
    label:       'Ausente',
    activeClass: 'bg-slate-400 text-slate-900 border-slate-300',
    inactiveClass:'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-300',
  },
  {
    state:       'crown',
    label:       'Corona',
    activeClass: 'bg-amber-500 text-white border-amber-400',
    inactiveClass:'border-slate-600 text-slate-400 hover:border-amber-500 hover:text-amber-400',
  },
  {
    state:       'indicated_extraction',
    label:       'Ext. indicada',
    activeClass: 'bg-rose-500 text-white border-rose-400',
    inactiveClass:'border-slate-600 text-slate-400 hover:border-rose-500 hover:text-rose-400',
  },
]

// ─── SurfaceEditor ────────────────────────────────────────────────────────────
export default function SurfaceEditor({ toothFdi, surfaces, onChange }: SurfaceEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold">
        Diente {toothFdi} — superficies
      </p>

      {SURFACE_KEYS.map(({ key, label }) => {
        const current = surfaces[key]
        return (
          <div key={key}>
            <span className="text-xs text-slate-500 mb-1 block">{label}</span>
            <div className="flex flex-wrap gap-1">
              {SURFACE_STATES.map(({ state, label: stateLabel, activeClass, inactiveClass }) => {
                const isActive = current === state
                return (
                  <button
                    key={state}
                    onClick={() => onChange(key, state)}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                      isActive ? activeClass : inactiveClass
                    }`}
                  >
                    {stateLabel}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
