import React, { useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import NetInfo from '@react-native-community/netinfo'
import api from '../../lib/api'
import { useBrigadeStore } from '../../store/brigadeStore'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

export default function BrigadeQueueScreen({ navigation }: any) {
  const { t } = useTranslation()
  const {
    activeBrigade, offlineQueue, syncState,
    markSynced, markRejected, setSyncState, setLastSyncedAt, clearActiveBrigade,
  } = useBrigadeStore()

  const pending = useMemo(() => offlineQueue.filter(c => !c.synced), [offlineQueue])
  const synced  = useMemo(() => offlineQueue.filter(c => c.synced),  [offlineQueue])

  const doSync = useCallback(async () => {
    if (syncState === 'syncing' || !activeBrigade || pending.length === 0) return
    setSyncState('syncing')
    try {
      const { data } = await api.post('/api/sync/consultations', {
        brigade_id:    activeBrigade.id,
        consultations: pending.map(c => ({
          local_id:      c.local_id,
          patient_phone: c.patient_phone,
          patient_name:  c.patient_name,
          symptoms_text: c.symptoms_text,
          diagnosis:     c.diagnosis,
          medications:   c.medications,
          created_at:    c.created_at,
        })),
      })
      await markSynced(data.accepted)
      await markRejected(data.rejected)
      setLastSyncedAt(new Date().toISOString())
      setSyncState('idle')
    } catch {
      setSyncState('idle')
      Alert.alert(t('common.error_generic'))
    }
  }, [syncState, activeBrigade, pending, markSynced, markRejected, setSyncState, setLastSyncedAt, t])

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && syncState === 'idle' && pending.length > 0) {
        doSync()
      }
    })
    return () => unsubscribe()
  }, [syncState, pending, doSync])

  const handleLeave = useCallback(async () => {
    await clearActiveBrigade()
    navigation.goBack()
  }, [clearActiveBrigade, navigation])

  if (!activeBrigade) { navigation.goBack(); return null }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brigadeName}>{activeBrigade?.name}</Text>
        <TouchableOpacity style={styles.syncBtn} onPress={doSync} testID="sync-btn">
          <Text style={styles.syncBtnText}>{t('brigade.sync')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBadge} testID="pending-count">
          <Text style={[styles.statText, { color: colors.status.amber }]}>
            {t('brigade.pending_count', { count: pending.length })}
          </Text>
        </View>
        <View style={styles.statBadge} testID="synced-count">
          <Text style={[styles.statText, { color: colors.brand.green400 }]}>
            {t('brigade.synced_count', { count: synced.length })}
          </Text>
        </View>
      </View>

      <FlatList
        data={offlineQueue}
        keyExtractor={(c) => c.local_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            testID={`queue-item-${item.local_id}`}
            onPress={() => navigation.navigate('BrigadeConsultationScreen', { local_id: item.local_id })}
          >
            <View style={styles.cardRow}>
              <Text style={styles.patientName}>{item.patient_name}</Text>
              <Text style={[styles.badge, item.synced ? styles.badgeSynced : styles.badgePending]}>
                {item.synced ? t('brigade.synced') : t('brigade.draft')}
              </Text>
            </View>
            <Text style={styles.phone}>{item.patient_phone}</Text>
            {item.sync_error && <Text style={styles.errorText}>{item.sync_error}</Text>}
          </TouchableOpacity>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('BrigadeConsultationScreen', {})}
          testID="new-consultation-btn"
        >
          <Text style={styles.newBtnText}>{t('brigade.new_consultation')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLeave} testID="leave-btn">
          <Text style={styles.leaveText}>{t('brigade.leave')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.base },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing[4], backgroundColor: colors.ui.slate800, borderBottomWidth: 1, borderBottomColor: colors.surface.border,
  },
  brigadeName: { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, flex: 1 },
  syncBtn: { backgroundColor: colors.brand.green400, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  syncBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  statsRow: { flexDirection: 'row', gap: spacing[2], padding: spacing[3] },
  statBadge: { backgroundColor: colors.surface.card, borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderWidth: 1, borderColor: colors.surface.border },
  statText: { fontSize: typography.size.sm, fontFamily: 'DMSansSemibold' },
  list: { padding: spacing[3] },
  card: {
    backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[4],
    marginBottom: spacing[2], borderWidth: 1, borderColor: colors.surface.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[1] },
  patientName: { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary },
  badge: { fontSize: typography.size.xs, fontFamily: 'DMSansSemibold', paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.full },
  badgePending: { backgroundColor: colors.status.amber + '20', color: colors.status.amber },
  badgeSynced:  { backgroundColor: colors.surface.cardBrand, color: colors.text.brand },
  phone: { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: 'DMSans' },
  errorText: { fontSize: typography.size.xs, color: colors.status.red, marginTop: spacing[1], fontFamily: 'DMSans' },
  footer: { padding: spacing[4], gap: spacing[2] },
  newBtn: { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[4], alignItems: 'center' },
  newBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold' },
  leaveText: { color: colors.text.secondary, fontSize: typography.size.md, textAlign: 'center', fontFamily: 'DMSans' },
})
