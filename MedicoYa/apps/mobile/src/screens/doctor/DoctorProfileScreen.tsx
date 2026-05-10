import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

interface DoctorMe {
  available:    boolean
  avg_rating:   number | null
  rating_count: number
  bio:          string | null
  user:         { name: string | null; phone: string }
}

export default function DoctorProfileScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const language    = useAuthStore((s) => s.language)
  const setLanguage = useAuthStore((s) => s.setLanguage)
  const logout      = useAuthStore((s) => s.logout)

  const [available,   setAvailable]   = useState(false)
  const [avgRating,   setAvgRating]   = useState<number | null>(null)
  const [ratingCount, setRatingCount] = useState(0)
  const [name,        setName]        = useState('')
  const [bio,         setBio]         = useState('')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)

  useEffect(() => {
    api.get<DoctorMe>('/api/doctors/me')
      .then(({ data }) => {
        setAvailable(data.available)
        setAvgRating(data.avg_rating)
        setRatingCount(data.rating_count)
        setName(data.user.name ?? '')
        setBio(data.bio ?? '')
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

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/api/doctors/me', { name: name.trim(), bio: bio.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brand.green400} />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing[6] }]}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>{t('doctor.availability_label')}</Text>
        <Switch
          testID="availability-switch"
          value={available}
          onValueChange={handleToggle}
          trackColor={{ false: colors.surface.border, true: colors.brand.green400 }}
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

      <Text style={styles.fieldLabel}>{t('profile.name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('profile.name')}
        testID="name-input"
      />

      <Text style={styles.fieldLabel}>{t('doctor.bio_label')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={bio}
        onChangeText={setBio}
        placeholder={t('doctor.bio_placeholder')}
        multiline
        numberOfLines={3}
        testID="bio-input"
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        testID="save-btn"
      >
        {saving
          ? <ActivityIndicator color={colors.text.inverse} />
          : <Text style={styles.saveBtnText}>{saved ? t('profile.saved') : t('profile.save')}</Text>
        }
      </TouchableOpacity>

      <Text style={[styles.fieldLabel, { marginTop: spacing[6] }]}>{t('profile.language')}</Text>
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loading:        { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.base },
  container:      { padding: spacing[6], backgroundColor: colors.surface.base, flexGrow: 1 },
  title:          { fontSize: typography.size.xl, fontFamily: 'DMSerifDisplay', marginBottom: spacing[6], color: colors.text.primary },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[3] },
  label:          { fontSize: typography.size.base, color: colors.text.primary, fontFamily: 'DMSans' },
  ratingText:     { fontSize: typography.size.md, color: colors.status.amber, fontFamily: 'DMSansSemibold', marginBottom: spacing[6] },
  fieldLabel:     { fontSize: typography.size.md, color: colors.text.secondary, marginBottom: spacing[2], marginTop: spacing[3], fontFamily: 'DMSans' },
  input:          {
    borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.sm,
    padding: spacing[3], fontSize: typography.size.base, color: colors.text.primary,
    fontFamily: 'DMSans', backgroundColor: colors.surface.input,
  },
  multiline:      { minHeight: 80, textAlignVertical: 'top' },
  saveBtn:        {
    backgroundColor: colors.brand.green400, borderRadius: radius.full,
    padding: spacing[4], alignItems: 'center', marginTop: spacing[6],
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:    { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
  langRow:        { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  langBtn:        {
    paddingVertical: spacing[2], paddingHorizontal: spacing[4],
    borderWidth: 1, borderColor: colors.surface.border, borderRadius: radius.sm,
  },
  langBtnActive:  { borderColor: colors.surface.borderBrand, backgroundColor: colors.surface.cardBrand },
  langText:       { color: colors.text.secondary, fontFamily: 'DMSansMedium' },
  langTextActive: { color: colors.text.brand, fontFamily: 'DMSansSemibold' },
  logoutBtn:      {
    marginTop: spacing[8], padding: spacing[4], backgroundColor: colors.status.red,
    borderRadius: radius.full, alignItems: 'center',
  },
  logoutText:     { color: colors.text.primary, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
})
