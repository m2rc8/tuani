import React, { useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import NetInfo from '@react-native-community/netinfo'
import api from '../../lib/api'
import { useBrigadeStore } from '../../store/brigadeStore'

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
      setSyncState('error')
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
          <Text style={[styles.statText, { color: '#F59E0B' }]}>
            {t('brigade.pending_count', { count: pending.length })}
          </Text>
        </View>
        <View style={styles.statBadge} testID="synced-count">
          <Text style={[styles.statText, { color: '#10B981' }]}>
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  brigadeName: { fontSize: 16, fontWeight: '700', color: '#1E293B', flex: 1 },
  syncBtn: { backgroundColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 8, padding: 12 },
  statBadge: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  statText: { fontSize: 12, fontWeight: '600' },
  list: { padding: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  patientName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  badge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePending: { backgroundColor: '#FEF3C7', color: '#D97706' },
  badgeSynced:  { backgroundColor: '#D1FAE5', color: '#059669' },
  phone: { fontSize: 12, color: '#94A3B8' },
  errorText: { fontSize: 11, color: '#EF4444', marginTop: 4 },
  footer: { padding: 16, gap: 8 },
  newBtn: { backgroundColor: '#EF4444', borderRadius: 10, padding: 14, alignItems: 'center' },
  newBtnText: { color: '#fff', fontWeight: '700' },
  leaveText: { color: '#94A3B8', fontSize: 13, textAlign: 'center' },
})
