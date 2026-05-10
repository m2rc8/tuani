'use client'

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

interface OdontogramProps {
  teeth: ToothRecord[]
  selectedTooth: number | null
  onSelectTooth: (fdi: number) => void
  onSurfaceClick: (fdi: number, surface: SurfaceKey) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────
const UPPER_ROW: number[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_ROW: number[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

const SURFACE_COLOR: Record<ToothSurface, string> = {
  healthy:               'transparent',
  caries:                '#ef4444',
  filled:                '#3b82f6',
  missing:               '#6b7280',
  crown:                 '#f59e0b',
  indicated_extraction:  '#ff6b6b',
}

const SURFACE_STROKE: Record<ToothSurface, string> = {
  healthy:               '#64748b',
  caries:                '#ef4444',
  filled:                '#3b82f6',
  missing:               '#6b7280',
  crown:                 '#f59e0b',
  indicated_extraction:  '#ff6b6b',
}

// ─── Single Tooth SVG ─────────────────────────────────────────────────────────
interface ToothSvgProps {
  fdi: number
  record: ToothRecord | undefined
  selected: boolean
  onSelect: () => void
  onSurface: (surface: SurfaceKey) => void
}

function ToothSvg({ fdi, record, selected, onSelect, onSurface }: ToothSvgProps) {
  function surfaceColor(key: SurfaceKey): string {
    const state = record?.[key] ?? 'healthy'
    return SURFACE_COLOR[state]
  }

  function surfaceStroke(key: SurfaceKey): string {
    const state = record?.[key] ?? 'healthy'
    return SURFACE_STROKE[state]
  }

  const outerStroke = selected ? '#38bdf8' : '#475569'
  const outerWidth  = selected ? 2 : 1

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-slate-500 text-[9px] leading-none">{fdi}</span>
      <svg
        width={32}
        height={32}
        viewBox="0 0 32 32"
        onClick={onSelect}
        className="cursor-pointer"
        style={{ outline: selected ? '2px solid #38bdf8' : 'none', outlineOffset: 1, borderRadius: 2 }}
      >
        {/* Outer border */}
        <rect x={0} y={0} width={32} height={32} fill="none" stroke={outerStroke} strokeWidth={outerWidth} />

        {/* Vestibular — top triangle */}
        <polygon
          points="4,0 28,0 24,8 8,8"
          fill={surfaceColor('surface_vestibular')}
          stroke={surfaceStroke('surface_vestibular')}
          strokeWidth={0.5}
          onClick={e => { e.stopPropagation(); onSurface('surface_vestibular') }}
          className="cursor-pointer hover:opacity-80"
        />

        {/* Palatal — bottom triangle */}
        <polygon
          points="8,24 24,24 28,32 4,32"
          fill={surfaceColor('surface_palatal')}
          stroke={surfaceStroke('surface_palatal')}
          strokeWidth={0.5}
          onClick={e => { e.stopPropagation(); onSurface('surface_palatal') }}
          className="cursor-pointer hover:opacity-80"
        />

        {/* Mesial — left triangle */}
        <polygon
          points="0,4 8,8 8,24 0,28"
          fill={surfaceColor('surface_mesial')}
          stroke={surfaceStroke('surface_mesial')}
          strokeWidth={0.5}
          onClick={e => { e.stopPropagation(); onSurface('surface_mesial') }}
          className="cursor-pointer hover:opacity-80"
        />

        {/* Distal — right triangle */}
        <polygon
          points="24,8 32,4 32,28 24,24"
          fill={surfaceColor('surface_distal')}
          stroke={surfaceStroke('surface_distal')}
          strokeWidth={0.5}
          onClick={e => { e.stopPropagation(); onSurface('surface_distal') }}
          className="cursor-pointer hover:opacity-80"
        />

        {/* Occlusal — center square */}
        <polygon
          points="8,8 24,8 24,24 8,24"
          fill={surfaceColor('surface_occlusal')}
          stroke={surfaceStroke('surface_occlusal')}
          strokeWidth={0.5}
          onClick={e => { e.stopPropagation(); onSurface('surface_occlusal') }}
          className="cursor-pointer hover:opacity-80"
        />
      </svg>
    </div>
  )
}

// ─── Odontogram Component ─────────────────────────────────────────────────────
export default function Odontogram({ teeth, selectedTooth, onSelectTooth, onSurfaceClick }: OdontogramProps) {
  const teethMap = new Map<number, ToothRecord>()
  for (const t of teeth) teethMap.set(t.tooth_fdi, t)

  function renderRow(fdis: number[], label1: string, label2: string) {
    const half = fdis.length / 2
    const left = fdis.slice(0, half)
    const right = fdis.slice(half)

    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-sky-400 font-bold w-5 shrink-0">{label1}</span>
        <div className="flex gap-1">
          {left.map(fdi => (
            <ToothSvg
              key={fdi}
              fdi={fdi}
              record={teethMap.get(fdi)}
              selected={selectedTooth === fdi}
              onSelect={() => onSelectTooth(fdi)}
              onSurface={surface => onSurfaceClick(fdi, surface)}
            />
          ))}
        </div>
        <div className="w-px h-8 bg-slate-600 shrink-0" />
        <div className="flex gap-1">
          {right.map(fdi => (
            <ToothSvg
              key={fdi}
              fdi={fdi}
              record={teethMap.get(fdi)}
              selected={selectedTooth === fdi}
              onSelect={() => onSelectTooth(fdi)}
              onSurface={surface => onSurfaceClick(fdi, surface)}
            />
          ))}
        </div>
        <span className="text-[10px] text-sky-400 font-bold w-5 shrink-0">{label2}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Upper row: Q1 (right half) | Q2 (left half) */}
      {renderRow(UPPER_ROW, 'Q1', 'Q2')}

      {/* Divider */}
      <div className="h-px bg-slate-700 w-full" />

      {/* Lower row: Q4 (right half) | Q3 (left half) */}
      {renderRow(LOWER_ROW, 'Q4', 'Q3')}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-2">
        {(Object.entries(SURFACE_COLOR) as [ToothSurface, string][]).map(([state, color]) => (
          <div key={state} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-sm border border-slate-500"
              style={{ backgroundColor: color === 'transparent' ? '#1e293b' : color }}
            />
            <span className="text-[10px] text-slate-400 capitalize">
              {state === 'indicated_extraction' ? 'Ext. indicada' : state}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
