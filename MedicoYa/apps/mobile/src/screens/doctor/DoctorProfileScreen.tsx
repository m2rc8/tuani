import React, { useEffect, useState } from 'react'
import {
  View, Text, Switch, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

export default function DoctorProfileScreen() {
  const { t } = useTranslation()
  const language    = useAuthStore((s) => s.language)
  const setLanguage = useAuthStore((s) => s.setLanguage)
  const logout      = useAuthStore((s) => s.logout)

  const [available, setAvailable] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    api.get<{ available: boolean }>('/api/doctors/me')
      .then(({ data }) => setAvailable(data.available))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (value: boolean) => {
    const prev = available
    setAvailable(value)
    try {
      await api.put('/api/doctors/availability', { available: value })
    } catch {
      setAvailable(prev)
      Alert.alert(t('common.error_generic'))
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      {loading ? (
        <ActivityIndicator color="#3B82F6" style={styles.loader} />
      ) : (
        <View style={styles.row}>
          <Text style={styles.label}>{t('doctor.availability_label')}</Text>
          <Switch
            testID="availability-switch"
            value={available}
            onValueChange={handleToggle}
            trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
            thumbColor="#fff"
          />
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('profile.language')}</Text>
      <View style={styles.langRow}>
        <TouchableOpacity
          onPress={() => setLanguage('es')}
          style={[styles.langBtn, language === 'es' && styles.langBtnActive]}
          testID="lang-es"
        >
          <Text style={language === 'es' ? styles.langTextActive : styles.langText}>ES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setLanguage('en')}
          style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
          testID="lang-en"
        >
          <Text style={language === 'en' ? styles.langTextActive : styles.langText}>EN</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={logout} style={styles.logoutBtn} testID="logout-btn">
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 24 },
  title:        { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  loader:       { marginBottom: 24 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  label:        { fontSize: 16, color: '#1E293B' },
  sectionLabel: { fontSize: 16, marginBottom: 8 },
  langRow:      { flexDirection: 'row', gap: 8, marginBottom: 32 },
  langBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6,
  },
  langBtnActive:  { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  langText:       { color: '#64748B', fontWeight: '500' },
  langTextActive: { color: '#3B82F6', fontWeight: '600' },
  logoutBtn: {
    marginTop: 'auto', padding: 14, backgroundColor: '#EF4444',
    borderRadius: 8, alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
