import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useBrigadeStore } from '../../store/brigadeStore'
import type { BrigadeInfo } from '../../lib/types'

interface BrigadeListItem extends BrigadeInfo {
  joined_at: string
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

  useEffect(() => {
    api.get<BrigadeListItem[]>('/api/brigades')
      .then(({ data }) => {
        setBrigadesLocal(data)
        setBrigades(data.map(b => ({ id: b.id, name: b.name, community: b.community, status: b.status })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setBrigades])

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
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={brigades}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>{t('brigade.my_brigades')}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.brigadeRow}>
              <View style={styles.brigadeInfo}>
                <Text style={styles.brigadeName}>{item.name}</Text>
                <Text style={styles.brigadeComm}>{item.community}</Text>
              </View>
              <TouchableOpacity
                style={styles.enterBtn}
                onPress={() => handleEnter(item.id)}
                testID={`enter-${item.id}`}
              >
                <Text style={styles.enterBtnText}>{t('brigade.enter')}</Text>
              </TouchableOpacity>
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
                    style={[styles.searchBtn, { backgroundColor: '#10B981' }]}
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  list: { padding: 16 },
  sectionLabel: { fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  brigadeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  brigadeInfo: { flex: 1 },
  brigadeName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  brigadeComm: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  enterBtn: { backgroundColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  enterBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  joinSection: { marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12,
    fontSize: 16, marginBottom: 8, backgroundColor: '#fff', letterSpacing: 2,
  },
  searchBtn: {
    backgroundColor: '#3B82F6', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 8,
  },
  searchBtnText: { color: '#fff', fontWeight: '700' },
  preview: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 8,
  },
  previewName: { fontSize: 15, fontWeight: '600', color: '#1E293B', marginBottom: 2 },
  previewComm: { fontSize: 12, color: '#94A3B8', marginBottom: 10 },
})
