import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import type { ConsultationStatus } from '../../lib/types'

interface ConsultationListItem {
  id: string
  status: ConsultationStatus
  diagnosis: string | null
  created_at: string
  prescription: { id: string } | null
}

const STATUS_COLORS: Record<ConsultationStatus, string> = {
  pending: '#F59E0B',
  active: '#3B82F6',
  completed: '#22C55E',
  rejected: '#EF4444',
  cancelled: '#94A3B8',
}

export default function PatientHistoryScreen({ navigation }: any) {
  const { t } = useTranslation()
  const [items, setItems] = useState<ConsultationListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<ConsultationListItem[]>('/api/consultations/my')
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handlePress = (item: ConsultationListItem) => {
    if (item.status === 'completed') {
      navigation.navigate('PrescriptionScreen', { consultationId: item.id })
    } else if (item.status === 'active' || item.status === 'pending') {
      navigation.navigate('ConsultationScreen', { consultationId: item.id })
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('history.empty')}</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const color = STATUS_COLORS[item.status] ?? '#94A3B8'
        const date = item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handlePress(item)}
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
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#94A3B8' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  date: { fontSize: 13, color: '#64748B' },
  badge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  diagnosis: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
})
