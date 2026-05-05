import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'

export default function ProfileScreen() {
  const { t } = useTranslation()
  const language = useAuthStore((s) => s.language)
  const setLanguage = useAuthStore((s) => s.setLanguage)
  const logout = useAuthStore((s) => s.logout)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      <Text style={styles.label}>{t('profile.language')}</Text>
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
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  label: { fontSize: 16, marginBottom: 8 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  langBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6,
  },
  langBtnActive: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  langText: { color: '#64748B', fontWeight: '500' },
  langTextActive: { color: '#3B82F6', fontWeight: '600' },
  logoutBtn: {
    marginTop: 'auto', padding: 14, backgroundColor: '#EF4444',
    borderRadius: 8, alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
