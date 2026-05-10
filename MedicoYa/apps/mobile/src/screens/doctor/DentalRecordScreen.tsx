import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import type { DentalRecord, ToothRecord, ToothSurface } from '../../lib/dentalTypes'
import type { SurfaceMap } from './components/SurfaceEditor'
import Odontogram from './components/Odontogram'
import SurfaceEditor from './components/SurfaceEditor'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

const PROCEDURES = ['Extracción', 'Obturación', 'Limpieza', 'Corona', 'Sellador', 'Profilaxis', 'Endodoncia', 'Otro']

function surfaceMapFromTooth(t: ToothRecord | undefined): SurfaceMap {
  return {
    surface_vestibular: (t?.surface_vestibular ?? 'healthy') as ToothSurface,
    surface_occlusal:   (t?.surface_occlusal   ?? 'healthy') as ToothSurface,
    surface_palatal:    (t?.surface_palatal     ?? 'healthy') as ToothSurface,
    surface_mesial:     (t?.surface_mesial      ?? 'healthy') as ToothSurface,
    surface_distal:     (t?.surface_distal      ?? 'healthy') as ToothSurface,
  }
}

export default function DentalRecordScreen({ navigation: _navigation, route }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { patientId, brigadeId } = route.params as { patientId: string; brigadeId?: string }

  const [record,      setRecord]      = useState<DentalRecord | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null)
  const [surfaces,    setSurfaces]    = useState<SurfaceMap | null>(null)
  const [dirtyTeeth,  setDirtyTeeth]  = useState<Record<number, SurfaceMap>>({})
  // Treatment form
  const [procedure,    setProcedure]    = useState('')
  const [txNotes,      setTxNotes]      = useState('')
  const [txMaterials,  setTxMaterials]  = useState('')
  const [addingTx,     setAddingTx]     = useState(false)

  useEffect(() => {
    api.post<DentalRecord>('/api/dental/records', { patient_id: patientId, brigade_id: brigadeId })
      .then(({ data }) => setRecord(data))
      .catch(() => Alert.alert(t('common.error_generic')))
      .finally(() => setLoading(false))
  }, [patientId, brigadeId, t])

  const handleSelectTooth = useCallback((fdi: number) => {
    setSelectedFdi(fdi)
    const toothData    = record?.teeth.find(tooth => tooth.tooth_fdi === fdi)
    const currentDirty = dirtyTeeth[fdi]
    setSurfaces(currentDirty ?? surfaceMapFromTooth(toothData))
  }, [record, dirtyTeeth])

  const handleSurfaceChange = useCallback((updated: SurfaceMap) => {
    setSurfaces(updated)
    if (selectedFdi !== null) {
      setDirtyTeeth(prev => ({ ...prev, [selectedFdi]: updated }))
    }
  }, [selectedFdi])

  const handleSaveOdontogram = async () => {
    if (!record || Object.keys(dirtyTeeth).length === 0) return
    setSaving(true)
    try {
      const teeth = Object.entries(dirtyTeeth).map(([fdi, s]) => ({
        tooth_fdi:          Number(fdi),
        surface_vestibular: s.surface_vestibular,
        surface_occlusal:   s.surface_occlusal,
        surface_palatal:    s.surface_palatal,
        surface_mesial:     s.surface_mesial,
        surface_distal:     s.surface_distal,
      }))
      const { data } = await api.put<DentalRecord>(`/api/dental/records/${record.id}/teeth`, { teeth })
      setRecord(data)
      setDirtyTeeth({})
      Alert.alert('Odontograma guardado')
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setSaving(false)
    }
  }

  const handleAddTreatment = async () => {
    if (!record || !procedure.trim()) return
    setAddingTx(true)
    try {
      const mats = txMaterials.split(',').map(m => m.trim()).filter(Boolean)
      const { data } = await api.post(`/api/dental/records/${record.id}/treatments`, {
        tooth_fdi: selectedFdi ?? undefined,
        procedure: procedure.trim(),
        notes:     txNotes.trim() || undefined,
        materials: mats.length > 0 ? mats : undefined,
        status:    'completed',
        priority:  'elective',
      })
      setRecord(prev => prev ? { ...prev, treatments: [...prev.treatments, data] } : prev)
      setProcedure('')
      setTxNotes('')
      setTxMaterials('')
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setAddingTx(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.brand.green400} size="large" />
      </View>
    )
  }

  const teeth      = record?.teeth      ?? []
  const treatments = record?.treatments ?? []
  const hasDirty   = Object.keys(dirtyTeeth).length > 0

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Odontograma</Text>

        <Odontogram
          teeth={teeth}
          selectedFdi={selectedFdi}
          onSelectTooth={handleSelectTooth}
        />

        {selectedFdi !== null && surfaces !== null && (
          <SurfaceEditor
            fdi={selectedFdi}
            surfaces={surfaces}
            onChange={handleSurfaceChange}
          />
        )}

        {hasDirty && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSaveOdontogram}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.text.inverse} />
              : <Text style={styles.saveBtnText}>Guardar odontograma</Text>}
          </TouchableOpacity>
        )}

        {/* Treatments */}
        <Text style={styles.sectionTitle}>Tratamientos ({treatments.length})</Text>

        {treatments.map(tx => (
          <View key={tx.id} style={styles.txCard}>
            <Text style={styles.txProcedure}>{tx.procedure}</Text>
            {tx.tooth_fdi != null && <Text style={styles.txMeta}>Pieza {tx.tooth_fdi}</Text>}
            {tx.notes && <Text style={styles.txNotes}>{tx.notes}</Text>}
            {tx.materials && tx.materials.length > 0 && (
              <View style={styles.materialsRow}>
                {tx.materials.map((m, i) => (
                  <View key={i} style={styles.materialChip}>
                    <Text style={styles.materialChipText}>{m}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Add treatment */}
        <View style={styles.txForm}>
          <Text style={styles.txFormTitle}>
            {`Agregar tratamiento${selectedFdi != null ? ` — Pieza ${selectedFdi}` : ''}`}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.procedureRow}>
            {PROCEDURES.map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setProcedure(p)}
                style={[styles.procedureChip, procedure === p && styles.procedureChipActive]}
              >
                <Text style={[styles.procedureChipText, procedure === p && styles.procedureChipTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput
            style={styles.input}
            value={txNotes}
            onChangeText={setTxNotes}
            placeholder="Notas (opcional)"
            placeholderTextColor={colors.text.muted}
            multiline
            numberOfLines={2}
          />
          <TextInput
            style={[styles.input, { minHeight: 40 }]}
            value={txMaterials}
            onChangeText={setTxMaterials}
            placeholder="Materiales (separados por coma)"
            placeholderTextColor={colors.text.muted}
          />
          <TouchableOpacity
            style={[styles.addTxBtn, (!procedure.trim() || addingTx) && styles.addTxBtnDisabled]}
            onPress={handleAddTreatment}
            disabled={!procedure.trim() || addingTx}
          >
            {addingTx
              ? <ActivityIndicator color={colors.text.inverse} />
              : <Text style={styles.addTxBtnText}>Agregar</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: colors.surface.base },
  center:                 { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.base },
  scroll:                 { padding: spacing[4], paddingBottom: spacing[12] },
  title:                  { fontSize: typography.size.lg, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginBottom: spacing[3] },
  sectionTitle:           { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginTop: spacing[6], marginBottom: spacing[3] },
  saveBtn:                { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[3], alignItems: 'center', marginTop: spacing[3] },
  saveBtnDisabled:        { opacity: 0.4 },
  saveBtnText:            { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  txCard:                 { backgroundColor: colors.surface.card, borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[2] },
  txProcedure:            { color: colors.text.primary, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  txMeta:                 { color: colors.text.brand, fontSize: typography.size.sm, fontFamily: 'DMSans', marginTop: 2 },
  txNotes:                { color: colors.text.secondary, fontSize: typography.size.sm, fontFamily: 'DMSans', marginTop: 2 },
  txForm:                 { backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[4], marginTop: spacing[3] },
  txFormTitle:            { color: colors.text.secondary, fontSize: typography.size.sm, fontFamily: 'DMSans', marginBottom: spacing[2] },
  procedureRow:           { marginBottom: spacing[3] },
  procedureChip:          { borderWidth: 1, borderColor: colors.surface.border, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1], marginRight: spacing[2] },
  procedureChipActive:    { borderColor: colors.brand.green400, backgroundColor: colors.surface.cardBrand },
  procedureChipText:      { color: colors.text.secondary, fontSize: typography.size.sm, fontFamily: 'DMSans' },
  procedureChipTextActive:{ color: colors.text.brand },
  input:                  { borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.sm, padding: spacing[3], color: colors.text.primary, fontFamily: 'DMSans', fontSize: typography.size.md, backgroundColor: colors.surface.input, marginBottom: spacing[3], minHeight: 60, textAlignVertical: 'top' },
  addTxBtn:               { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[3], alignItems: 'center' },
  addTxBtnDisabled:       { opacity: 0.4 },
  addTxBtnText:           { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  materialsRow:           { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[2], gap: spacing[1] },
  materialChip:           { backgroundColor: colors.surface.cardBrand, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  materialChipText:       { color: colors.text.brand, fontSize: typography.size.xs, fontFamily: 'DMSans' },
})
