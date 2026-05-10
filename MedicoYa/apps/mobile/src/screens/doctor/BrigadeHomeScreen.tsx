import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useBrigadeStore } from '../../store/brigadeStore'
import type { BrigadeInfo } from '../../lib/types'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

interface BrigadeListItem extends BrigadeInfo {
  joined_at: string
  is_organizer?: boolean
}

export default function BrigadeHomeScreen({ navigation }: any) {
  const { t } = useTranslation()
  const { setBrigades, setActiveBrigade } = useBrigadeStore()
  const [brigades, setBrigadesLocal] = useState<BrigadeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [preview, setPreview] = useState<{ id: string; name: string; community: string } | null>(null)
  const [joining, setJoining] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    api.get<BrigadeListItem[]>('/api/brigades')
      .then(({ data }) => {
        setBrigadesLocal(data)
        setBrigades(data.map(b => ({ id: b.id, name: b.name, community: b.community, status: b.status })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setBrigades, refreshKey])

  const handleEnter = useCallback(async (brigadeId: string) => {
    try {
      const { data } = await api.get<{ brigade: BrigadeInfo; doctors: any[]; patients: { phone: string; name: string }[] }>(
        `/api/sync/brigade/${brigadeId}`
      )
      await setActiveBrigade(data.brigade, data.patients)
      navigation.navigate('BrigadeQueueScreen')
    } catch {
      Alert.alert(t('common.error_generic'))
    }
  }, [navigation, setActiveBrigade, t])

  const handleSearch = useCallback(async () => {
    if (joinCode.length !== 6) return
    setSearching(true)
    setPreview(null)
    try {
      const { data } = await api.get<{ id: string; name: string; community: string }>(
        `/api/brigades/by-code/${joinCode.toUpperCase()}`
      )
      setPreview(data)
    } catch {
      Alert.alert(t('brigade.error_code_not_found'))
    } finally {
      setSearching(false)
    }
  }, [joinCode, t])

  const handleJoin = useCallback(async () => {
    if (!preview) return
    setJoining(true)
    try {
      await api.post(`/api/brigades/${preview.id}/join`, { join_code: joinCode.toUpperCase() })
      const { data } = await api.get<{ brigade: BrigadeInfo; doctors: any[]; patients: { phone: string; name: string }[] }>(
        `/api/sync/brigade/${preview.id}`
      )
      await setActiveBrigade(data.brigade, data.patients)
      setRefreshKey(k => k + 1)
      navigation.navigate('BrigadeQueueScreen')
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setJoining(false)
    }
  }, [preview, joinCode, navigation, setActiveBrigade, t])

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={colors.brand.green400} style={{ marginTop: spacing[8] }} />
      ) : (
        <FlatList
          data={brigades}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => navigation.navigate('CreateEditBrigadeScreen', {})}
                testID="create-brigade-btn"
              >
                <Text style={styles.createBtnText}>{t('brigade.create_btn')}</Text>
              </TouchableOpacity>
              <Text style={styles.sectionLabel}>{t('brigade.my_brigades')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.brigadeRow}>
              <View style={styles.brigadeInfo}>
                <Text style={styles.brigadeName}>{item.name}</Text>
                <Text style={styles.brigadeComm}>{item.community}</Text>
              </View>
              <View style={styles.rowActions}>
                {item.is_organizer && (
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => navigation.navigate('CreateEditBrigadeScreen', {
                      brigadeId: item.id,
                      initialData: { name: item.name, community: item.community, brigade_type: item.brigade_type ?? 'medical' },
                    })}
                    testID={`edit-${item.id}`}
                  >
                    <Text style={styles.editBtnText}>✎</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.enterBtn}
                  onPress={() => handleEnter(item.id)}
                  testID={`enter-${item.id}`}
                >
                  <Text style={styles.enterBtnText}>{t('brigade.enter')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.joinSection}>
              <Text style={styles.sectionLabel}>{t('brigade.join_section')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('brigade.join_code_placeholder')}
                value={joinCode}
                onChangeText={(v) => { setJoinCode(v.toUpperCase()); setPreview(null) }}
                maxLength={6}
                autoCapitalize="characters"
                testID="join-code-input"
              />
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={handleSearch}
                disabled={searching || joinCode.length !== 6}
                testID="search-btn"
              >
                <Text style={styles.searchBtnText}>
                  {searching ? '...' : t('brigade.search')}
                </Text>
              </TouchableOpacity>
              {preview && (
                <View style={styles.preview}>
                  <Text style={styles.previewName}>{preview.name}</Text>
                  <Text style={styles.previewComm}>{preview.community}</Text>
                  <TouchableOpacity
                    style={styles.searchBtn}
                    onPress={handleJoin}
                    disabled={joining}
                    testID="confirm-join-btn"
                  >
                    <Text style={styles.searchBtnText}>
                      {joining ? '...' : t('brigade.confirm_join')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.base },
  list: { padding: spacing[4] },
  sectionLabel: { fontSize: typography.size.sm, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing[2], marginTop: spacing[2], fontFamily: 'DMSansSemibold' },
  brigadeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[2],
    borderWidth: 1, borderColor: colors.surface.border,
  },
  brigadeInfo: { flex: 1 },
  brigadeName: { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary },
  brigadeComm: { fontSize: typography.size.sm, color: colors.text.secondary, marginTop: 2, fontFamily: 'DMSans' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  enterBtn: { backgroundColor: colors.brand.green400, borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  enterBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  editBtn: { borderWidth: 1, borderColor: colors.surface.border, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2], backgroundColor: colors.surface.card },
  editBtnText: { fontSize: typography.size.base, color: colors.text.secondary },
  createBtn: { backgroundColor: colors.surface.card, borderWidth: 1, borderColor: colors.brand.green400, borderRadius: radius.full, paddingVertical: spacing[2], paddingHorizontal: spacing[4], alignSelf: 'flex-end', marginBottom: spacing[3] },
  createBtnText: { color: colors.brand.green400, fontFamily: 'DMSansSemibold', fontSize: typography.size.sm },
  joinSection: { marginTop: spacing[4] },
  input: {
    borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.sm, padding: spacing[3],
    fontSize: typography.size.base, marginBottom: spacing[2], backgroundColor: colors.surface.input, letterSpacing: 2,
    fontFamily: 'DMSans', color: colors.text.primary,
  },
  searchBtn: {
    backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[3], alignItems: 'center', marginBottom: spacing[2],
  },
  searchBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold' },
  preview: {
    backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[4],
    borderWidth: 1, borderColor: colors.surface.borderBrand, marginBottom: spacing[2],
  },
  previewName: { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginBottom: 2 },
  previewComm: { fontSize: typography.size.sm, color: colors.text.secondary, marginBottom: spacing[3], fontFamily: 'DMSans' },
})
