import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../../lib/api'
import type { DentalVisit, ToothRecord } from '../../lib/dentalTypes'
import Odontogram from '../doctor/components/Odontogram'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function PatientDentalVisitScreen({ route }: any) {
  const insets = useSafeAreaInsets()
  const { visitId, fileId } = route.params as { visitId: string; fileId: string }

  const [visit, setVisit] = useState<DentalVisit | null>(null)
  const [teeth, setTeeth] = useState<ToothRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<DentalVisit>(`/api/dental/visits/${visitId}`),
      api.get<{ teeth: ToothRecord[] }>(`/api/dental/files/${fileId}`),
    ])
      .then(([visitRes, fileRes]) => {
        setVisit(visitRes.data)
        setTeeth(fileRes.data.teeth)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [visitId, fileId])

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.brand.green400} size="large" />
      </View>
    )
  }

  if (!visit) return null

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4] }]}
    >
      <Text style={styles.title}>Visita dental</Text>
      <Text style={styles.subtitle}>{fmtDate(visit.visit_date)}</Text>

      {visit.dentist && (
        <Text style={styles.dentist}>
          {visit.dentist.first_name && visit.dentist.last_name
            ? `${visit.dentist.first_name} ${visit.dentist.last_name}`
            : visit.dentist.name ?? 'Dentista'}
        </Text>
      )}

      <Text style={styles.sectionTitle}>Odontograma</Text>
      <Odontogram teeth={teeth} selectedFdi={null} onSelectTooth={() => {}} />

      {visit.hygiene_notes ? (
        <>
          <Text style={styles.sectionTitle}>Higiene oral</Text>
          <Text style={styles.bodyText}>{visit.hygiene_notes}</Text>
        </>
      ) : null}

      {visit.cpod_index != null ? (
        <>
          <Text style={styles.sectionTitle}>Índice CPOD</Text>
          <Text style={styles.bodyText}>{visit.cpod_index}</Text>
        </>
      ) : null}

      {visit.treatment_plan ? (
        <>
          <Text style={styles.sectionTitle}>Plan de tratamiento</Text>
          <Text style={styles.bodyText}>{visit.treatment_plan}</Text>
        </>
      ) : null}

      {visit.referral_to ? (
        <>
          <Text style={styles.sectionTitle}>Referencia</Text>
          <Text style={styles.bodyText}>{visit.referral_to}</Text>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>
        Tratamientos ({visit.treatments.length})
      </Text>

      {visit.treatments.length === 0 ? (
        <Text style={styles.emptyText}>Sin tratamientos registrados.</Text>
      ) : (
        visit.treatments.map(tx => (
          <View key={tx.id} style={styles.txCard}>
            <Text style={styles.txProcedure}>{tx.procedure}</Text>
            {tx.tooth_fdi != null && (
              <Text style={styles.txMeta}>Pieza {tx.tooth_fdi}</Text>
            )}
            {tx.notes ? (
              <Text style={styles.txNotes}>{tx.notes}</Text>
            ) : null}
            {(tx.started_at || tx.ended_at) && (
              <View style={{ marginTop: spacing[1] }}>
                {tx.started_at ? (
                  <Text style={styles.txDate}>Inicio: {fmtDatetime(tx.started_at)}</Text>
                ) : null}
                {tx.ended_at ? (
                  <Text style={styles.txDate}>Fin: {fmtDatetime(tx.ended_at)}</Text>
                ) : null}
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
                    <Image
                      source={{ uri: tx.before_image_url }}
                      style={styles.txImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
                {tx.after_image_url && (
                  <View style={styles.imageWrapper}>
                    <Text style={styles.imageLabel}>Después</Text>
                    <Image
                      source={{ uri: tx.after_image_url }}
                      style={styles.txImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.surface.base },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.base },
  scroll:           { padding: spacing[4], paddingBottom: spacing[12] },
  title:            { fontSize: typography.size.xl, fontFamily: 'DMSerifDisplay', color: colors.text.primary, marginBottom: 2 },
  subtitle:         { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: 'DMSans', marginBottom: 2 },
  dentist:          { fontSize: typography.size.sm, color: colors.text.muted, fontFamily: 'DMSans', marginBottom: spacing[2] },
  sectionTitle:     { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginTop: spacing[4], marginBottom: spacing[2] },
  bodyText:         { fontSize: typography.size.md, color: colors.text.primary, fontFamily: 'DMSans', lineHeight: 22 },
  emptyText:        { color: colors.text.secondary, fontFamily: 'DMSans', fontSize: typography.size.sm },
  txCard:           { backgroundColor: colors.surface.card, borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[2], borderWidth: 1, borderColor: colors.surface.border },
  txProcedure:      { color: colors.text.primary, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  txMeta:           { color: colors.text.brand, fontSize: typography.size.sm, fontFamily: 'DMSans', marginTop: 2 },
  txNotes:          { color: colors.text.secondary, fontSize: typography.size.sm, fontFamily: 'DMSans', marginTop: 2 },
  txDate:           { color: colors.text.secondary, fontSize: typography.size.xs, fontFamily: 'DMSans' },
  materialsRow:     { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[2], gap: spacing[1] },
  materialChip:     { backgroundColor: colors.surface.cardBrand, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  materialChipText: { color: colors.text.brand, fontSize: typography.size.xs, fontFamily: 'DMSans' },
  imagesRow:        { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  imageWrapper:     { flex: 1 },
  imageLabel:       { color: colors.text.secondary, fontSize: typography.size.xs, fontFamily: 'DMSansSemibold', marginBottom: 4, textTransform: 'uppercase' },
  txImage:          { width: '100%', height: 120, borderRadius: radius.sm },
})
