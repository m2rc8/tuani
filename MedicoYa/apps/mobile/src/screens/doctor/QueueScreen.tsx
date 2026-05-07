import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import type { QueueItem } from '../../lib/types'

function timeAgo(isoString: string): string {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h`
}

export default function QueueScreen({ navigation }: any) {
  const { t } = useTranslation()
  const token = useAuthStore((s: any) => s.token)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  useEffect(() => {
    api.get<QueueItem[]>('/api/consultations/queue')
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false))

    socketService.connect(baseURL, token ?? '')

    const handleNew = (item: QueueItem) => setItems((prev) => [item, ...prev])
    const handleUpdated = (data: { id: string; status: string }) => {
      if (data.status !== 'pending') removeItem(data.id)
    }

    socketService.on('new_consultation', handleNew)
    socketService.on('consultation_updated', handleUpdated)

    return () => {
      socketService.off('new_consultation', handleNew)
      socketService.off('consultation_updated', handleUpdated)
    }
  }, [baseURL, token, removeItem])

  const handleAccept = async (item: QueueItem) => {
    try {
      await api.put(`/api/consultations/${item.id}/accept`)
      removeItem(item.id)
      navigation.navigate('DoctorConsultationScreen', { consultationId: item.id })
    } catch {
      Alert.alert(t('common.error_generic'))
    }
  }

  const handleReject = async (item: QueueItem) => {
    try {
      await api.put(`/api/consultations/${item.id}/reject`)
      removeItem(item.id)
    } catch {
      Alert.alert(t('common.error_generic'))
    }
  }

  const banner = (
    <TouchableOpacity
      style={styles.brigadeBanner}
      onPress={() => navigation.navigate('BrigadeHomeScreen')}
      testID="brigade-banner"
    >
      <Text style={styles.brigadeBannerText}>{t('brigade.join_banner')}</Text>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.flex}>
        {banner}
        <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
      </View>
    )
  }

  if (items.length === 0) {
    return (
      <View style={styles.flex}>
        {banner}
        <View style={styles.center}><Text style={styles.emptyText}>{t('queue.empty')}</Text></View>
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      {banner}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const phone = item.patient.user.phone
          const masked = phone.slice(-4).padStart(phone.length, '•')
          return (
            <View style={styles.card} testID={`queue-item-${item.id}`}>
              <Text style={styles.phone}>{masked}</Text>
              {item.symptoms_text && (
                <Text style={styles.symptoms} numberOfLines={3}>{item.symptoms_text}</Text>
              )}
              <Text style={styles.time}>{t('queue.waiting_since')}: {timeAgo(item.created_at)}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAccept(item)}
                  testID={`accept-${item.id}`}
                >
                  <Text style={styles.acceptText}>{t('queue.accept')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleReject(item)}
                  testID={`reject-${item.id}`}
                >
                  <Text style={styles.rejectText}>{t('queue.reject')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#94A3B8' },
  list: { padding: 16 },
  brigadeBanner: {
    backgroundColor: '#EF4444',
    padding: 12,
    alignItems: 'center',
  },
  brigadeBannerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0',
  },
  phone: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  symptoms: { fontSize: 15, color: '#1E293B', marginBottom: 8 },
  time: { fontSize: 12, color: '#94A3B8', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flex: 1, backgroundColor: '#3B82F6', borderRadius: 8,
    padding: 10, alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '700' },
  rejectBtn: {
    flex: 1, borderWidth: 1, borderColor: '#EF4444',
    borderRadius: 8, padding: 10, alignItems: 'center',
  },
  rejectText: { color: '#EF4444', fontWeight: '600' },
})
