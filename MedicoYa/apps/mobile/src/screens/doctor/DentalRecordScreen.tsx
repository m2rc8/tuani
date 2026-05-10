import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import api from '../../lib/api'
import type { DentalVisit, DentalTreatment, ToothRecord, ToothSurface } from '../../lib/dentalTypes'
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

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function DentalRecordScreen({ navigation: _navigation, route }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { visitId, fileId } = route.params as { visitId: string; fileId: string }

  const [visit,       setVisit]       = useState<DentalVisit | null>(null)
  const [fileTeeth,   setFileTeeth]   = useState<ToothRecord[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null)
  const [surfaces,    setSurfaces]    = useState<SurfaceMap | null>(null)
  const [dirtyTeeth,  setDirtyTeeth]  = useState<Record<number, SurfaceMap>>({})

  // Referral
  const [referralTo, setReferralTo] = useState('')
  const [savingRef,  setSavingRef]  = useState(false)

  // Treatment plan
  const [treatmentPlan, setTreatmentPlan] = useState('')
  const [savingPlan,    setSavingPlan]    = useState(false)

  // Treatment form
  const [procedure,   setProcedure]   = useState('')
  const [txNotes,     setTxNotes]     = useState('')
  const [txMaterials, setTxMaterials] = useState('')
  const [addingTx,    setAddingTx]    = useState(false)

  // Treatment datetimes
  const [txStartedAt,      setTxStartedAt]      = useState<Date | null>(null)
  const [txEndedAt,        setTxEndedAt]         = useState<Date | null>(null)
  const [showStartPicker,  setShowStartPicker]   = useState(false)
  const [showEndPicker,    setShowEndPicker]      = useState(false)

  // Treatment images
  const [txBeforeUri, setTxBeforeUri] = useState<string | null>(null)
  const [txAfterUri,  setTxAfterUri]  = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<DentalVisit>(`/api/dental/visits/${visitId}`),
      api.get<{ teeth: ToothRecord[] }>(`/api/dental/files/${fileId}`),
    ])
      .then(([visitRes, fileRes]) => {
        setVisit(visitRes.data)
        setFileTeeth(fileRes.data.teeth)
        setReferralTo(visitRes.data.referral_to ?? '')
        setTreatmentPlan(visitRes.data.treatment_plan ?? '')
      })
      .catch(() => Alert.alert(t('common.error_generic')))
      .finally(() => setLoading(false))
  }, [visitId, fileId, t])

  const handleSelectTooth = useCallback((fdi: number) => {
    setSelectedFdi(fdi)
    const toothData    = fileTeeth.find(tooth => tooth.tooth_fdi === fdi)
    const currentDirty = dirtyTeeth[fdi]
    setSurfaces(currentDirty ?? surfaceMapFromTooth(toothData))
  }, [fileTeeth, dirtyTeeth])

  const handleSurfaceChange = useCallback((updated: SurfaceMap) => {
    setSurfaces(updated)
    if (selectedFdi !== null) {
      setDirtyTeeth(prev => ({ ...prev, [selectedFdi]: updated }))
    }
  }, [selectedFdi])

  const handleSaveOdontogram = async () => {
    if (Object.keys(dirtyTeeth).length === 0) return
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
      const { data } = await api.put<{ teeth: ToothRecord[] }>(`/api/dental/files/${fileId}/teeth`, { teeth })
      setFileTeeth(data.teeth)
      setDirtyTeeth({})
      Alert.alert('Odontograma guardado')
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveReferral = async () => {
    setSavingRef(true)
    try {
      await api.patch(`/api/dental/visits/${visitId}`, {
        referral_to: referralTo.trim() || null,
      })
      Alert.alert('Referencia guardada')
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setSavingRef(false)
    }
  }

  const handleSavePlan = async () => {
    setSavingPlan(true)
    try {
      await api.patch(`/api/dental/visits/${visitId}`, {
        treatment_plan: treatmentPlan.trim() || null,
      })
      setVisit(prev => prev ? { ...prev, treatment_plan: treatmentPlan.trim() || null } : prev)
      Alert.alert('Plan guardado')
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setSavingPlan(false)
    }
  }

  const pickImage = async (type: 'before' | 'after') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'Images' })
      if (result.canceled) return
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      )
      if (type === 'before') setTxBeforeUri(compressed.uri)
      else                   setTxAfterUri(compressed.uri)
    } catch {
      Alert.alert(t('common.error_generic'))
    }
  }

  const uploadTreatmentImage = async (txId: string, uri: string, type: 'before' | 'after') => {
    const formData = new FormData()
    formData.append('image', { uri, type: 'image/jpeg', name: 'photo.jpg' } as any)
    formData.append('type', type)
    const { data } = await api.post<DentalTreatment>(
      `/api/dental/visits/${visitId}/treatments/${txId}/images`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
    return data
  }

  const handleAddTreatment = async () => {
    if (!procedure.trim()) return
    setAddingTx(true)
    try {
      const mats = txMaterials.split(',').map(m => m.trim()).filter(Boolean)
      const body: Record<string, unknown> = {
        tooth_fdi: selectedFdi ?? undefined,
        procedure: procedure.trim(),
        status:    'completed',
        priority:  'elective',
      }
      if (txNotes.trim())  body.notes     = txNotes.trim()
      if (mats.length > 0) body.materials = mats
      if (txStartedAt)     body.started_at = txStartedAt.toISOString()
      if (txEndedAt)       body.ended_at   = txEndedAt.toISOString()

      const { data: newTx } = await api.post<DentalTreatment>(
        `/api/dental/visits/${visitId}/treatments`, body
      )

      let finalTx = newTx
      if (txBeforeUri) finalTx = await uploadTreatmentImage(newTx.id, txBeforeUri, 'before')
      if (txAfterUri)  finalTx = await uploadTreatmentImage(newTx.id, txAfterUri,  'after')

      setVisit(prev => prev ? { ...prev, treatments: [...prev.treatments, finalTx] } : prev)
      setProcedure(''); setTxNotes(''); setTxMaterials('')
      setTxStartedAt(null); setTxEndedAt(null)
      setTxBeforeUri(null); setTxAfterUri(null)
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

  const teeth      = fileTeeth
  const treatments = visit?.treatments ?? []
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

        {/* Treatment plan */}
        <Text style={styles.sectionTitle}>Plan de tratamiento</Text>
        <TextInput
          style={[styles.input, { minHeight: 90 }]}
          value={treatmentPlan}
          onChangeText={setTreatmentPlan}
          placeholder="Describe el plan de tratamiento general del paciente..."
          placeholderTextColor={colors.text.muted}
          multiline
          numberOfLines={4}
        />
        <TouchableOpacity
          style={[styles.saveBtn, savingPlan && styles.saveBtnDisabled]}
          onPress={handleSavePlan}
          disabled={savingPlan}
        >
          {savingPlan
            ? <ActivityIndicator color={colors.text.inverse} />
            : <Text style={styles.saveBtnText}>Guardar plan</Text>}
        </TouchableOpacity>

        {/* Referral */}
        <Text style={styles.sectionTitle}>Referencia a especialista</Text>
        <TextInput
          style={styles.input}
          value={referralTo}
          onChangeText={setReferralTo}
          placeholder="Ej: Ortodoncista, Cirujano maxilofacial..."
          placeholderTextColor={colors.text.muted}
        />
        <TouchableOpacity
          style={[styles.saveBtn, savingRef && styles.saveBtnDisabled]}
          onPress={handleSaveReferral}
          disabled={savingRef}
        >
          {savingRef
            ? <ActivityIndicator color={colors.text.inverse} />
            : <Text style={styles.saveBtnText}>Guardar referencia</Text>}
        </TouchableOpacity>

        {/* Treatments list */}
        <Text style={styles.sectionTitle}>Tratamientos ({treatments.length})</Text>

        {treatments.map(tx => (
          <View key={tx.id} style={styles.txCard}>
            <Text style={styles.txProcedure}>{tx.procedure}</Text>
            {tx.tooth_fdi != null && <Text style={styles.txMeta}>Pieza {tx.tooth_fdi}</Text>}
            {tx.notes && <Text style={styles.txNotes}>{tx.notes}</Text>}

            {(tx.started_at || tx.ended_at) && (
              <View style={styles.txDates}>
                {tx.started_at && (
                  <Text style={styles.txDateText}>Inicio: {fmtDatetime(tx.started_at)}</Text>
                )}
                {tx.ended_at && (
                  <Text style={styles.txDateText}>Fin: {fmtDatetime(tx.ended_at)}</Text>
                )}
              </View>
            )}

            {tx.materials && tx.materials.length > 0 && (
              <View style={styles.materialsRow}>
                {tx.materials.map((m, i) => (
                  <View key={i} style={styles.materialChip}>
                    <Text style={styles.materialChipText}>{m}</Text>
                  </View>
                ))}
              </View>
            )}

            {(tx.before_image_url || tx.after_image_url) && (
              <View style={styles.imagesRow}>
                {tx.before_image_url && (
                  <View style={styles.imageWrapper}>
                    <Text style={styles.imageLabel}>Antes</Text>
                    <Image source={{ uri: tx.before_image_url }} style={styles.txImage} resizeMode="cover" />
                  </View>
                )}
                {tx.after_image_url && (
                  <View style={styles.imageWrapper}>
                    <Text style={styles.imageLabel}>Después</Text>
                    <Image source={{ uri: tx.after_image_url }} style={styles.txImage} resizeMode="cover" />
                  </View>
                )}
              </View>
            )}
          </View>
        ))}

        {/* Add treatment form */}
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

          {/* Datetime pickers */}
          <Text style={styles.pickerLabel}>Fecha/hora inicio</Text>
          <TouchableOpacity style={styles.datetimeBtn} onPress={() => setShowStartPicker(true)}>
            <Text style={[styles.datetimeBtnText, !txStartedAt && styles.placeholder]}>
              {txStartedAt ? fmtDatetime(txStartedAt.toISOString()) : 'Seleccionar'}
            </Text>
          </TouchableOpacity>
          {showStartPicker && (
            <DateTimePicker
              value={txStartedAt ?? new Date()}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_e: DateTimePickerEvent, d?: Date) => {
                setShowStartPicker(Platform.OS === 'ios')
                if (d) setTxStartedAt(d)
              }}
            />
          )}

          <Text style={styles.pickerLabel}>Fecha/hora fin</Text>
          <TouchableOpacity style={styles.datetimeBtn} onPress={() => setShowEndPicker(true)}>
            <Text style={[styles.datetimeBtnText, !txEndedAt && styles.placeholder]}>
              {txEndedAt ? fmtDatetime(txEndedAt.toISOString()) : 'Seleccionar'}
            </Text>
          </TouchableOpacity>
          {showEndPicker && (
            <DateTimePicker
              value={txEndedAt ?? txStartedAt ?? new Date()}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={txStartedAt ?? undefined}
              onChange={(_e: DateTimePickerEvent, d?: Date) => {
                setShowEndPicker(Platform.OS === 'ios')
                if (d) setTxEndedAt(d)
              }}
            />
          )}

          {/* Before / After images */}
          <View style={styles.imgBtnRow}>
            <TouchableOpacity style={styles.imgBtn} onPress={() => pickImage('before')}>
              <Text style={styles.imgBtnText}>{txBeforeUri ? '✓ Foto antes' : '+ Foto antes'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imgBtn} onPress={() => pickImage('after')}>
              <Text style={styles.imgBtnText}>{txAfterUri ? '✓ Foto después' : '+ Foto después'}</Text>
            </TouchableOpacity>
          </View>

          {(txBeforeUri || txAfterUri) && (
            <View style={styles.imagesRow}>
              {txBeforeUri && (
                <View style={styles.imageWrapper}>
                  <Text style={styles.imageLabel}>Antes</Text>
                  <Image source={{ uri: txBeforeUri }} style={styles.txImage} resizeMode="cover" />
                </View>
              )}
              {txAfterUri && (
                <View style={styles.imageWrapper}>
                  <Text style={styles.imageLabel}>Después</Text>
                  <Image source={{ uri: txAfterUri }} style={styles.txImage} resizeMode="cover" />
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.addTxBtn, (!procedure.trim() || addingTx) && styles.addTxBtnDisabled]}
            onPress={handleAddTreatment}
            disabled={!procedure.trim() || addingTx}
          >
            {addingTx
              ? <ActivityIndicator color={colors.text.inverse} />
              : <Text style={styles.addTxBtnText}>Agregar tratamiento</Text>}
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
  txDates:                { marginTop: spacing[2] },
  txDateText:             { color: colors.text.secondary, fontSize: typography.size.xs, fontFamily: 'DMSans' },
  txForm:                 { backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[4], marginTop: spacing[3] },
  txFormTitle:            { color: colors.text.secondary, fontSize: typography.size.sm, fontFamily: 'DMSans', marginBottom: spacing[2] },
  procedureRow:           { marginBottom: spacing[3] },
  procedureChip:          { borderWidth: 1, borderColor: colors.surface.border, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1], marginRight: spacing[2] },
  procedureChipActive:    { borderColor: colors.brand.green400, backgroundColor: colors.surface.cardBrand },
  procedureChipText:      { color: colors.text.secondary, fontSize: typography.size.sm, fontFamily: 'DMSans' },
  procedureChipTextActive:{ color: colors.text.brand },
  input:                  { borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.sm, padding: spacing[3], color: colors.text.primary, fontFamily: 'DMSans', fontSize: typography.size.md, backgroundColor: colors.surface.input, marginBottom: spacing[3], minHeight: 60, textAlignVertical: 'top' },
  pickerLabel:            { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: 'DMSans', marginBottom: spacing[1] },
  datetimeBtn:            { borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.sm, padding: spacing[3], backgroundColor: colors.surface.input, marginBottom: spacing[3] },
  datetimeBtnText:        { color: colors.text.primary, fontFamily: 'DMSans', fontSize: typography.size.md },
  placeholder:            { color: colors.text.muted },
  imgBtnRow:              { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  imgBtn:                 { flex: 1, borderWidth: 1, borderColor: colors.surface.border, borderRadius: radius.sm, padding: spacing[3], alignItems: 'center' },
  imgBtnText:             { color: colors.text.secondary, fontSize: typography.size.sm, fontFamily: 'DMSans' },
  imagesRow:              { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2], marginBottom: spacing[2] },
  imageWrapper:           { flex: 1 },
  imageLabel:             { color: colors.text.secondary, fontSize: typography.size.xs, fontFamily: 'DMSansSemibold', marginBottom: 4, textTransform: 'uppercase' },
  txImage:                { width: '100%', height: 120, borderRadius: radius.sm },
  addTxBtn:               { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  addTxBtnDisabled:       { opacity: 0.4 },
  addTxBtnText:           { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  materialsRow:           { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[2], gap: spacing[1] },
  materialChip:           { backgroundColor: colors.surface.cardBrand, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  materialChipText:       { color: colors.text.brand, fontSize: typography.size.xs, fontFamily: 'DMSans' },
})
