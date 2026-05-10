import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import type { QueueItem } from '../../lib/types'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

function timeAgo(isoString: string): string {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h`
}

export default function QueueScreen({ navigation }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const token = useAuthStore((s: any) => s.token)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const [items,    setItems]    = useState<QueueItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [approved, setApproved] = useState<boolean | null>(null)

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const fetchQueue = useCallback(() => {
    api.get<{ approved_at: string | null }>('/api/doctors/me')
      .then(({ data }) => setApproved(!!data.approved_at))
      .catch(() => setApproved(true))
    api.get<QueueItem[]>('/api/consultations/queue')
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchQueue()
    const poll = setInterval(fetchQueue, 10_000)

    socketService.connect(baseURL, token ?? '')

    const handleNew = (item: QueueItem) => setItems((prev) => [item, ...prev])
    const handleUpdated = (data: { id: string; status: string }) => {
      if (data.status !== 'pending') removeItem(data.id)
    }

    socketService.on('new_consultation', handleNew)
    socketService.on('consultation_updated', handleUpdated)

    return () => {
      clearInterval(poll)
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
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        {banner}
        <View style={styles.center}><ActivityIndicator size="large" color={colors.brand.green400} /></View>
      </View>
    )
  }

  if (approved === false) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Text style={styles.pendingIcon}>⏳</Text>
          <Text style={styles.pendingTitle}>{t('doctor.pending_title')}</Text>
          <Text style={styles.pendingBody}>{t('doctor.pending_body')}</Text>
        </View>
      </View>
    )
  }

  if (items.length === 0) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        {banner}
        <View style={styles.center}><Text style={styles.emptyText}>{t('queue.empty')}</Text></View>
      </View>
    )
  }

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
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
  emptyText:    { fontSize: typography.size.base, color: colors.ui.slate600, fontFamily: 'DMSans' },
  pendingIcon:  { fontSize: 48, marginBottom: spacing[4] },
  pendingTitle: { fontSize: typography.size.lg, fontFamily: 'DMSansSemibold', color: colors.ui.slate900, marginBottom: spacing[2] },
  pendingBody:  { fontSize: typography.size.md, color: colors.ui.slate600, textAlign: 'center', paddingHorizontal: spacing[8], fontFamily: 'DMSans' },
  list: { padding: spacing[4] },
  brigadeBanner: {
    backgroundColor: colors.status.red,
    padding: spacing[3],
    alignItems: 'center',
  },
  brigadeBannerText: { color: colors.ui.white, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  card: {
    backgroundColor: colors.ui.white, borderRadius: radius.md, padding: spacing[4],
    marginBottom: spacing[3], borderWidth: 1, borderColor: colors.ui.slate200,
  },
  phone: { fontSize: typography.size.md, color: colors.ui.slate600, marginBottom: spacing[2], fontFamily: 'DMSans' },
  symptoms: { fontSize: typography.size.base, color: colors.ui.slate900, marginBottom: spacing[2], fontFamily: 'DMSans' },
  time: { fontSize: typography.size.sm, color: colors.ui.slate600, marginBottom: spacing[3], fontFamily: 'DMSans' },
  actions: { flexDirection: 'row', gap: spacing[3] },
  acceptBtn: {
    flex: 1, backgroundColor: colors.brand.green400, borderRadius: radius.sm,
    padding: spacing[3], alignItems: 'center',
  },
  acceptText: { color: colors.ui.white, fontFamily: 'DMSansSemibold' },
  rejectBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.status.red,
    borderRadius: radius.sm, padding: spacing[3], alignItems: 'center',
  },
  rejectText: { color: colors.status.red, fontFamily: 'DMSansSemibold' },
})
