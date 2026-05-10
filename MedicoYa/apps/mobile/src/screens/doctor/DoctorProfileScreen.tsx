import React, { useEffect, useState } from 'react'
import {
  View, Text, Switch, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

export default function DoctorProfileScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const language    = useAuthStore((s) => s.language)
  const setLanguage = useAuthStore((s) => s.setLanguage)
  const logout      = useAuthStore((s) => s.logout)

  const [available,    setAvailable]    = useState(false)
  const [avgRating,    setAvgRating]    = useState<number | null>(null)
  const [ratingCount,  setRatingCount]  = useState(0)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    api.get<{ available: boolean; avg_rating: number | null; rating_count: number }>('/api/doctors/me')
      .then(({ data }) => {
        setAvailable(data.available)
        setAvgRating(data.avg_rating)
        setRatingCount(data.rating_count)
      })
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
    <View style={[styles.container, { paddingTop: insets.top + spacing[6] }]}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      {loading ? (
        <ActivityIndicator color={colors.brand.green400} style={styles.loader} />
      ) : (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>{t('doctor.availability_label')}</Text>
            <Switch
              testID="availability-switch"
              value={available}
              onValueChange={handleToggle}
              trackColor={{ false: colors.ui.slate200, true: colors.brand.green400 }}
              thumbColor={colors.ui.white}
            />
          </View>

          {ratingCount > 0 && (
            <Text style={styles.ratingText} testID="avg-rating">
              {'★ '}
              {avgRating !== null ? avgRating.toFixed(1) : '—'}
              {` (${ratingCount} ${t('consultation.avg_rating')})`}
            </Text>
          )}
        </>
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
  container:    { flex: 1, padding: spacing[6] },
  title:        { fontSize: typography.size.xl, fontFamily: 'DMSerifDisplay', marginBottom: spacing[6] },
  loader:       { marginBottom: spacing[6] },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  label:        { fontSize: typography.size.base, color: colors.ui.slate900, fontFamily: 'DMSans' },
  ratingText:   { fontSize: typography.size.md, color: colors.status.amber, fontFamily: 'DMSansSemibold', marginBottom: spacing[6] },
  sectionLabel: { fontSize: typography.size.base, marginBottom: spacing[2], fontFamily: 'DMSans' },
  langRow:      { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[8] },
  langBtn: {
    paddingVertical: spacing[2], paddingHorizontal: spacing[4],
    borderWidth: 1, borderColor: colors.ui.slate200, borderRadius: radius.sm,
  },
  langBtnActive:  { borderColor: colors.brand.green400, backgroundColor: colors.brand.green50 },
  langText:       { color: colors.ui.slate600, fontFamily: 'DMSansMedium' },
  langTextActive: { color: colors.brand.green400, fontFamily: 'DMSansSemibold' },
  logoutBtn: {
    marginTop: 'auto', padding: spacing[4], backgroundColor: colors.status.red,
    borderRadius: radius.sm, alignItems: 'center',
  },
  logoutText: { color: colors.ui.white, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
})
