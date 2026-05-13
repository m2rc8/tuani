import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import type { ConsultationStatus } from '../../lib/types'
import type { DentalPatientFile, DentalVisit } from '../../lib/dentalTypes'
import Odontogram from '../doctor/components/Odontogram'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

interface ConsultationListItem {
  id: string
  status: ConsultationStatus
  diagnosis: string | null
  created_at: string
  prescription: { id: string } | null
}

const STATUS_COLORS: Record<ConsultationStatus, string> = {
  pending:   colors.status.amber,
  active:    colors.status.blue,
  completed: colors.brand.green400,
  rejected:  colors.status.red,
  cancelled: colors.text.muted,
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function PatientHistoryScreen({ navigation }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<'medical' | 'dental'>('medical')

  const [medical, setMedical] = useState<ConsultationListItem[]>([])
  const [dentalFile, setDentalFile] = useState<DentalPatientFile | null>(null)
  const [dentalEmpty, setDentalEmpty] = useState(false)
  const [loadingMedical, setLoadingMedical] = useState(true)
  const [loadingDental, setLoadingDental] = useState(true)

  useEffect(() => {
    api.get<ConsultationListItem[]>('/api/consultations/my')
      .then(({ data }) => setMedical(data))
      .catch(() => {})
      .finally(() => setLoadingMedical(false))

    api.get<DentalPatientFile>('/api/dental/files/mine')
      .then(({ data }) => setDentalFile(data))
      .catch((err: any) => {
        if (err?.response?.status === 404) setDentalEmpty(true)
      })
      .finally(() => setLoadingDental(false))
  }, [])

  const handlePressConsultation = (item: ConsultationListItem) => {
    if (item.status === 'completed') {
      navigation.navigate('PrescriptionScreen', { consultationId: item.id })
    } else if (item.status === 'active' || item.status === 'pending') {
      navigation.navigate('ConsultationScreen', { consultationId: item.id })
    }
  }

  const loading = tab === 'medical' ? loadingMedical : loadingDental

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'medical' && styles.tabActive]}
          onPress={() => setTab('medical')}
        >
          <Text style={[styles.tabText, tab === 'medical' && styles.tabTextActive]}>
            {t('history.tab_medical')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'dental' && styles.tabActive]}
          onPress={() => setTab('dental')}
        >
          <Text style={[styles.tabText, tab === 'dental' && styles.tabTextActive]}>
            {t('history.tab_dental')}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand.green400} />
        </View>
      ) : tab === 'medical' ? (
        medical.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
          </View>
        ) : (
          <FlatList
            data={medical}
            keyExtractor={(i) => i.id}
            style={styles.screen}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const color = STATUS_COLORS[item.status] ?? colors.text.muted
              const date = new Date(item.created_at).toLocaleDateString()
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => handlePressConsultation(item)}
                  testID={`consultation-${item.id}`}
                >
                  <View style={styles.row}>
                    <Text style={styles.date}>{date}</Text>
                    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.badgeText, { color }]}>
                        {t(`history.status.${item.status}`)}
                      </Text>
                    </View>
                  </View>
                  {item.diagnosis && (
                    <Text style={styles.diagnosis}>{item.diagnosis}</Text>
                  )}
                </TouchableOpacity>
              )
            }}
          />
        )
      ) : dentalEmpty || !dentalFile ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('history.empty_dental')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.sectionTitle}>{t('dental.odontogram')}</Text>
          <Odontogram
            teeth={dentalFile.teeth}
            selectedFdi={null}
            onSelectTooth={() => {}}
          />
          <Text style={styles.sectionTitle}>
            {t('dental.treatments')} ({dentalFile.visits.length})
          </Text>
          {dentalFile.visits.length === 0 ? (
            <Text style={styles.emptyText}>{t('history.empty_dental')}</Text>
          ) : (
            dentalFile.visits.map((visit: DentalVisit) => (
              <TouchableOpacity
                key={visit.id}
                style={styles.card}
                onPress={() => navigation.navigate('PatientDentalVisitScreen', {
                  visitId: visit.id,
                  fileId: dentalFile.id,
                })}
              >
                <View style={styles.row}>
                  <Text style={styles.date}>{fmtDate(visit.visit_date)}</Text>
                  <View style={[styles.badge, { backgroundColor: colors.brand.green400 + '20' }]}>
                    <Text style={[styles.badgeText, { color: colors.brand.green400 }]}>
                      {visit.treatments.length} {t('dental.treatments').toLowerCase()}
                    </Text>
                  </View>
                </View>
                {visit.dentist && (
                  <Text style={styles.secondaryText}>
                    {visit.dentist.first_name && visit.dentist.last_name
                      ? `${visit.dentist.first_name} ${visit.dentist.last_name}`
                      : visit.dentist.name ?? t('dental.dentist_label')}
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: colors.surface.base },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText:     { fontSize: typography.size.base, color: colors.text.secondary, fontFamily: 'DMSans' },
  tabs:          { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.surface.border },
  tab:           { flex: 1, paddingVertical: spacing[3], alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: colors.brand.green400 },
  tabText:       { fontSize: typography.size.base, color: colors.text.secondary, fontFamily: 'DMSans' },
  tabTextActive: { color: colors.brand.green400, fontFamily: 'DMSansSemibold' },
  list:          { padding: spacing[4] },
  sectionTitle:  { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginTop: spacing[4], marginBottom: spacing[2] },
  card:          { backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[4], marginBottom: spacing[3], borderWidth: 1, borderColor: colors.surface.border },
  row:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[1] },
  date:          { fontSize: typography.size.md, color: colors.text.secondary, fontFamily: 'DMSans' },
  badge:         { borderRadius: radius.sm, paddingVertical: 2, paddingHorizontal: spacing[2] },
  badgeText:     { fontSize: typography.size.sm, fontFamily: 'DMSansSemibold' },
  diagnosis:     { fontSize: typography.size.base, color: colors.text.primary, fontFamily: 'DMSansMedium' },
  secondaryText: { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: 'DMSans' },
})
