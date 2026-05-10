import React from 'react'
import { ScrollView, View, StyleSheet, Text } from 'react-native'
import Svg, { Polygon, G, Text as SvgText } from 'react-native-svg'
import type { ToothRecord, ToothSurface } from '../../../lib/dentalTypes'
import { tokens } from '../../../theme/tokens'

const { colors, typography, spacing } = tokens

const SURFACE_COLORS: Record<ToothSurface, string> = {
  healthy:              'transparent',
  caries:               colors.status.red,
  filled:               colors.status.blue,
  missing:              colors.ui.slate400,
  crown:                colors.status.amber,
  indicated_extraction: '#FF6B6B',
}

const TOOTH_SIZE = 28
const GAP = 4
const THIRD = TOOTH_SIZE / 3

// Upper teeth: right to left for FDI (18..11 then 21..28)
const UPPER_ROW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
// Lower teeth
const LOWER_ROW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

interface ToothViewProps {
  fdi:      number
  tooth:    ToothRecord | undefined
  onPress:  (fdi: number) => void
  selected: boolean
}

function ToothView({ fdi, tooth, onPress, selected }: ToothViewProps) {
  const S = TOOTH_SIZE
  const col = (surface: ToothSurface) => SURFACE_COLORS[surface]
  const stroke = selected ? colors.brand.green400 : colors.surface.inputBorder
  const sw = selected ? 2 : 0.5

  const vest = tooth ? col(tooth.surface_vestibular) : 'transparent'
  const pala = tooth ? col(tooth.surface_palatal)    : 'transparent'
  const mesi = tooth ? col(tooth.surface_mesial)     : 'transparent'
  const dist = tooth ? col(tooth.surface_distal)     : 'transparent'
  const occ  = tooth ? col(tooth.surface_occlusal)   : 'transparent'

  const missing = tooth?.surface_mesial === 'missing'

  return (
    <Svg
      width={S}
      height={S + 14}
      onPress={() => onPress(fdi)}
    >
      {/* FDI number */}
      <SvgText
        x={S / 2}
        y={11}
        fontSize={8}
        fill={selected ? colors.brand.green400 : colors.text.secondary}
        textAnchor="middle"
        fontFamily="DMSans"
      >
        {fdi}
      </SvgText>

      <G y={14}>
        {/* Background */}
        <Polygon
          points={`0,0 ${S},0 ${S},${S} 0,${S}`}
          fill={missing ? colors.ui.slate600 : colors.surface.card}
          stroke={stroke}
          strokeWidth={sw}
        />

        {!missing && (
          <>
            {/* Vestibular - top */}
            <Polygon
              points={`0,0 ${S},0 ${S - THIRD},${THIRD} ${THIRD},${THIRD}`}
              fill={vest}
              stroke={stroke}
              strokeWidth={0.3}
            />
            {/* Palatal - bottom */}
            <Polygon
              points={`${THIRD},${S - THIRD} ${S - THIRD},${S - THIRD} ${S},${S} 0,${S}`}
              fill={pala}
              stroke={stroke}
              strokeWidth={0.3}
            />
            {/* Mesial - left */}
            <Polygon
              points={`0,0 ${THIRD},${THIRD} ${THIRD},${S - THIRD} 0,${S}`}
              fill={mesi}
              stroke={stroke}
              strokeWidth={0.3}
            />
            {/* Distal - right */}
            <Polygon
              points={`${S},0 ${S},${S} ${S - THIRD},${S - THIRD} ${S - THIRD},${THIRD}`}
              fill={dist}
              stroke={stroke}
              strokeWidth={0.3}
            />
            {/* Occlusal - center */}
            <Polygon
              points={`${THIRD},${THIRD} ${S - THIRD},${THIRD} ${S - THIRD},${S - THIRD} ${THIRD},${S - THIRD}`}
              fill={occ}
              stroke={stroke}
              strokeWidth={0.3}
            />
          </>
        )}
      </G>
    </Svg>
  )
}

interface OdontogramProps {
  teeth:         ToothRecord[]
  selectedFdi:   number | null
  onSelectTooth: (fdi: number) => void
}

export default function Odontogram({ teeth, selectedFdi, onSelectTooth }: OdontogramProps) {
  const toothMap = Object.fromEntries(teeth.map(t => [t.tooth_fdi, t]))

  function renderRow(fdis: number[]) {
    return (
      <View style={styles.row}>
        {fdis.map((fdi, i) => (
          <View key={fdi} style={[styles.toothWrap, i === 7 && styles.midGap]}>
            <ToothView
              fdi={fdi}
              tooth={toothMap[fdi]}
              onPress={onSelectTooth}
              selected={selectedFdi === fdi}
            />
          </View>
        ))}
      </View>
    )
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      <View style={styles.grid}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Superior</Text>
        </View>
        {renderRow(UPPER_ROW)}
        <View style={styles.divider} />
        {renderRow(LOWER_ROW)}
        <View style={styles.labelRow}>
          <Text style={styles.label}>Inferior</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll:    { backgroundColor: colors.surface.card, borderRadius: 12 },
  grid:      { padding: spacing[3], alignItems: 'center' },
  row:       { flexDirection: 'row', gap: GAP },
  midGap:    { marginLeft: GAP * 3 },
  toothWrap: {},
  divider:   { height: spacing[2] },
  labelRow:  { alignSelf: 'flex-start', marginBottom: 2 },
  label:     { fontSize: typography.size.xs, color: colors.text.muted, fontFamily: 'DMSans' },
})
