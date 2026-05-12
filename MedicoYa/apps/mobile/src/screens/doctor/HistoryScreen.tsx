import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useFocusEffect } from '@react-navigation/native'
import api from '../../lib/api'
import type { ConsultationStatus } from '../../lib/types'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

interface ConsultationListItem {
  id: string
  status: ConsultationStatus
  diagnosis: string | null
  created_at: string
  mode: string
  prescription: { id: string } | null
  patient?: { user?: { name?: string | null } } | null
}

interface DentalVisitListItem {
  id: string
  file_id: string
  visit_date: string
  referral_to?: string | null
  file: { patient: { user: { name?: string | null } } }
  treatments: { id: string }[]
}

const STATUS_COLORS: Record<ConsultationStatus, string> = {
  pending:   colors.status.amber,
  active:    colors.status.blue,
  completed: colors.brand.green400,
  rejected:  colors.status.red,
  cancelled: colors.text.muted,
}

export default function DoctorHistoryScreen({ navigation }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<'medical' | 'dental'>('medical')

  const [medical, setMedical] = useState<ConsultationListItem[]>([])
  const [dental,  setDental]  = useState<DentalVisitListItem[]>([])
  const [loadingMedical, setLoadingMedical] = useState(true)
  const [loadingDental,  setLoadingDental]  = useState(true)

  useFocusEffect(useCallback(() => {
    setLoadingMedical(true)
    api.get<ConsultationListItem[]>('/api/consultations/my')
      .then(({ data }) => setMedical(data))
      .catch(() => {})
      .finally(() => setLoadingMedical(false))

    setLoadingDental(true)
    api.get<DentalVisitListItem[]>('/api/dental/dentist/mine/visits')
      .then(({ data }) => setDental(data))
      .catch(() => {})
      .finally(() => setLoadingDental(false))
  }, []))

  const handlePressConsultation = (item: ConsultationListItem) => {
    if (item.status === 'completed') {
      navigation.navigate('PrescriptionScreen', { consultationId: item.id })
    } else if (item.status === 'active' || item.status === 'pending') {
      navigation.navigate('DoctorConsultationScreen', { consultationId: item.id })
    }
  }

  const handlePressDental = (item: DentalVisitListItem) => {
    navigation.navigate('DentalRecordScreen', { visitId: item.id, fileId: item.file_id })
  }

  const loading = tab === 'medical' ? loadingMedical : loadingDental

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Tabs */}
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
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brand.green400} /></View>
      ) : tab === 'medical' ? (
        medical.length === 0 ? (
          <View style={styles.center}><Text style={styles.emptyText}>{t('history.empty')}</Text></View>
        ) : (
          <FlatList
            data={medical}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const color = STATUS_COLORS[item.status] ?? colors.text.muted
              const date = new Date(item.created_at).toLocaleDateString()
              const patientName = item.patient?.user?.name
              return (
                <TouchableOpacity style={styles.card} onPress={() => handlePressConsultation(item)}>
                  <View style={styles.row}>
                    <Text style={styles.date}>{date}</Text>
                    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.badgeText, { color }]}>{t(`history.status.${item.status}`)}</Text>
                    </View>
                  </View>
                  {patientName && <Text style={styles.patientName}>{patientName}</Text>}
                  {item.diagnosis && <Text style={styles.diagnosis}>{item.diagnosis}</Text>}
                  {item.mode === 'brigade' && (
                    <Text style={styles.modeBadge}>{t('history.brigade_mode')}</Text>
                  )}
                </TouchableOpacity>
              )
            }}
          />
        )
      ) : (
        dental.length === 0 ? (
          <View style={styles.center}><Text style={styles.emptyText}>{t('history.empty_dental')}</Text></View>
        ) : (
          <FlatList
            data={dental}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const date = new Date(item.visit_date).toLocaleDateString()
              const patientName = item.file?.patient?.user?.name ?? '—'
              return (
                <TouchableOpacity style={styles.card} onPress={() => handlePressDental(item)}>
                  <View style={styles.row}>
                    <Text style={styles.date}>{date}</Text>
                    <View style={[styles.badge, { backgroundColor: colors.brand.green400 + '20' }]}>
                      <Text style={[styles.badgeText, { color: colors.brand.green400 }]}>
                        {item.treatments.length} {t('dental.treatments').toLowerCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.patientName}>{patientName}</Text>
                  {item.referral_to && (
                    <Text style={styles.referral}>{t('consultation.referred_to')}: {item.referral_to}</Text>
                  )}
                </TouchableOpacity>
              )
            }}
          />
        )
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
  card: {
    backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[4],
    marginBottom: spacing[3], borderWidth: 1, borderColor: colors.surface.border,
  },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[1] },
  date:        { fontSize: typography.size.md, color: colors.text.secondary, fontFamily: 'DMSans' },
  badge:       { borderRadius: radius.sm, paddingVertical: 2, paddingHorizontal: spacing[2] },
  badgeText:   { fontSize: typography.size.sm, fontFamily: 'DMSansSemibold' },
  patientName: { fontSize: typography.size.base, color: colors.text.primary, fontFamily: 'DMSansMedium', marginBottom: 2 },
  diagnosis:   { fontSize: typography.size.md, color: colors.text.secondary, fontFamily: 'DMSans' },
  modeBadge:   { fontSize: typography.size.xs, color: colors.teal.teal400, fontFamily: 'DMSans', marginTop: 2 },
  referral:    { fontSize: typography.size.sm, color: colors.status.amber, fontFamily: 'DMSans', marginTop: 2 },
})
