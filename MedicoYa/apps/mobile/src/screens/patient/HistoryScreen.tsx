import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import type { ConsultationStatus } from '../../lib/types'
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
  pending: colors.status.amber,
  active: colors.status.blue,
  completed: colors.brand.green400,
  rejected: colors.status.red,
  cancelled: colors.ui.slate600,
}

export default function PatientHistoryScreen({ navigation }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
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
    return <View style={[styles.center, { paddingTop: insets.top }]}><ActivityIndicator size="large" color={colors.brand.green400} /></View>
  }

  if (items.length === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>{t('history.empty')}</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={[styles.list, { paddingTop: insets.top + spacing[4] }]}
      renderItem={({ item }) => {
        const color = STATUS_COLORS[item.status] ?? colors.ui.slate600
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
  emptyText: { fontSize: typography.size.base, color: colors.ui.slate600, fontFamily: 'DMSans' },
  list: { padding: spacing[4] },
  card: {
    backgroundColor: colors.ui.white, borderRadius: radius.md, padding: spacing[4],
    marginBottom: spacing[3], borderWidth: 1, borderColor: colors.ui.slate200,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  date: { fontSize: typography.size.md, color: colors.ui.slate600, fontFamily: 'DMSans' },
  badge: { borderRadius: radius.sm, paddingVertical: 2, paddingHorizontal: spacing[2] },
  badgeText: { fontSize: typography.size.sm, fontFamily: 'DMSansSemibold' },
  diagnosis: { fontSize: typography.size.base, color: colors.ui.slate900, fontFamily: 'DMSansMedium' },
})
