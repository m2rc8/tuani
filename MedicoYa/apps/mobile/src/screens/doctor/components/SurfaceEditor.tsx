import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { ToothSurface } from '../../../lib/dentalTypes'
import { tokens } from '../../../theme/tokens'

const { colors, spacing, typography, radius } = tokens

export interface SurfaceMap {
  surface_vestibular: ToothSurface
  surface_occlusal:   ToothSurface
  surface_palatal:    ToothSurface
  surface_mesial:     ToothSurface
  surface_distal:     ToothSurface
}

const SURFACES: { key: keyof SurfaceMap; label: string }[] = [
  { key: 'surface_vestibular', label: 'Vest.' },
  { key: 'surface_occlusal',   label: 'Ocl.'  },
  { key: 'surface_palatal',    label: 'Pal.'  },
  { key: 'surface_mesial',     label: 'Mes.'  },
  { key: 'surface_distal',     label: 'Dist.' },
]

const STATES: ToothSurface[] = ['healthy', 'caries', 'filled', 'missing', 'crown', 'indicated_extraction']

const STATE_LABELS: Record<ToothSurface, string> = {
  healthy:              'Sano',
  caries:               'Caries',
  filled:               'Obturado',
  missing:              'Ausente',
  crown:                'Corona',
  indicated_extraction: 'Extracción',
}

const STATE_COLORS: Record<ToothSurface, string> = {
  healthy:              colors.brand.green400,
  caries:               colors.status.red,
  filled:               colors.status.blue,
  missing:              colors.ui.slate400,
  crown:                colors.status.amber,
  indicated_extraction: '#FF6B6B',
}

interface SurfaceEditorProps {
  fdi:      number
  surfaces: SurfaceMap
  onChange: (surfaces: SurfaceMap) => void
}

export default function SurfaceEditor({ fdi, surfaces, onChange }: SurfaceEditorProps) {
  function setSurface(key: keyof SurfaceMap, value: ToothSurface) {
    onChange({ ...surfaces, [key]: value })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pieza {fdi}</Text>
      {SURFACES.map(({ key, label }) => (
        <View key={key} style={styles.row}>
          <Text style={styles.surfaceLabel}>{label}</Text>
          <View style={styles.states}>
            {STATES.map(state => (
              <TouchableOpacity
                key={state}
                onPress={() => setSurface(key, state)}
                style={[
                  styles.stateBtn,
                  surfaces[key] === state && {
                    borderColor:     STATE_COLORS[state],
                    backgroundColor: STATE_COLORS[state] + '33',
                  },
                ]}
              >
                <Text style={[
                  styles.stateText,
                  surfaces[key] === state && { color: STATE_COLORS[state] },
                ]}>
                  {STATE_LABELS[state]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[3], marginTop: spacing[2] },
  title:        { color: colors.text.brand, fontFamily: 'DMSansSemibold', fontSize: typography.size.md, marginBottom: spacing[2] },
  row:          { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[2], gap: spacing[2] },
  surfaceLabel: { color: colors.text.secondary, fontSize: typography.size.sm, fontFamily: 'DMSans', width: 40 },
  states:       { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  stateBtn:     { borderWidth: 1, borderColor: colors.surface.border, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  stateText:    { color: colors.text.muted, fontSize: typography.size.xs, fontFamily: 'DMSans' },
})
