import React, { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import api from '../../lib/api'
import type { DentalPatientFile, DentalVisit } from '../../lib/dentalTypes'
import Odontogram from './components/Odontogram'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function dentistLabel(visit: DentalVisit): string {
  const d = visit.dentist
  if (!d) return 'Dentista'
  if (d.first_name && d.last_name) return `${d.first_name} ${d.last_name}`
  return d.name ?? 'Dentista'
}

export default function DentalExpedienteScreen({ navigation, route }: any) {
  const { fileId, patientName } = route.params as { fileId: string; patientName?: string }
  const insets = useSafeAreaInsets()

  const [file,     setFile]     = useState<DentalPatientFile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)

  const fetchFile = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<DentalPatientFile>(`/api/dental/files/${fileId}`)
      setFile(data)
    } catch {
      Alert.alert('Error al cargar expediente')
    } finally {
      setLoading(false)
    }
  }, [fileId])

  useFocusEffect(useCallback(() => {
    fetchFile()
  }, [fetchFile]))

  async function handleNewVisit() {
    setCreating(true)
    try {
      const { data } = await api.post<{ id: string }>(`/api/dental/files/${fileId}/visits`, {})
      navigation.navigate('DentalRecordScreen', { visitId: data.id, fileId })
    } catch {
      Alert.alert('Error al crear visita')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.brand.green400} size="large" />
      </View>
    )
  }

  if (!file) return null

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4] }]}
    >
      {patientName && <Text style={styles.patientName}>{patientName}</Text>}
      <Text style={styles.title}>Expediente dental</Text>

      <Text style={styles.sectionTitle}>Odontograma actual</Text>
      <Odontogram
        teeth={file.teeth}
        selectedFdi={null}
        onSelectTooth={() => {}}
      />

      <View style={styles.visitHeader}>
        <Text style={styles.sectionTitle}>Visitas ({file.visits.length})</Text>
        <TouchableOpacity
          style={[styles.newVisitBtn, creating && styles.btnDisabled]}
          onPress={handleNewVisit}
          disabled={creating}
        >
          {creating
            ? <ActivityIndicator color={colors.text.inverse} size="small" />
            : <Text style={styles.newVisitBtnText}>+ Nueva visita</Text>}
        </TouchableOpacity>
      </View>

      {file.visits.length === 0 ? (
        <Text style={styles.emptyText}>Sin visitas registradas.</Text>
      ) : (
        file.visits.map(visit => (
          <TouchableOpacity
            key={visit.id}
            style={styles.visitCard}
            onPress={() => navigation.navigate('DentalRecordScreen', { visitId: visit.id, fileId })}
          >
            <View style={styles.visitRow}>
              <Text style={styles.visitDate}>{fmtDate(visit.visit_date)}</Text>
              <Text style={styles.visitTx}>{visit.treatments.length} tx</Text>
            </View>
            <Text style={styles.visitDentist}>{dentistLabel(visit)}</Text>
            {visit.treatment_plan ? (
              <Text style={styles.visitPlan} numberOfLines={1}>{visit.treatment_plan}</Text>
            ) : null}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.surface.base },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.base },
  scroll:          { padding: spacing[4], paddingBottom: spacing[12] },
  patientName:     { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: 'DMSans', marginBottom: 2 },
  title:           { fontSize: typography.size.xl, fontFamily: 'DMSerifDisplay', color: colors.text.primary, marginBottom: spacing[4] },
  sectionTitle:    { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginTop: spacing[4], marginBottom: spacing[2] },
  visitHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[4], marginBottom: spacing[2] },
  newVisitBtn:     { backgroundColor: colors.brand.green400, borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  btnDisabled:     { opacity: 0.4 },
  newVisitBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.sm },
  emptyText:       { color: colors.text.secondary, fontFamily: 'DMSans', fontSize: typography.size.sm },
  visitCard:       { backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[4], marginBottom: spacing[2], borderWidth: 1, borderColor: colors.surface.border },
  visitRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  visitDate:       { color: colors.text.primary, fontFamily: 'DMSansMedium', fontSize: typography.size.md },
  visitTx:         { color: colors.text.brand, fontFamily: 'DMSans', fontSize: typography.size.sm },
  visitDentist:    { color: colors.text.secondary, fontFamily: 'DMSans', fontSize: typography.size.sm },
  visitPlan:       { color: colors.text.muted, fontFamily: 'DMSans', fontSize: typography.size.xs, marginTop: 2 },
})
