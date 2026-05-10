import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

interface PatientProfile {
  name:      string | null
  phone:     string
  dob:       string | null
  allergies: string | null
}

export default function PatientProfileScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const language    = useAuthStore((s) => s.language)
  const setLanguage = useAuthStore((s) => s.setLanguage)
  const logout      = useAuthStore((s) => s.logout)

  const [profile,   setProfile]   = useState<PatientProfile | null>(null)
  const [name,      setName]      = useState('')
  const [dob,       setDob]       = useState('')
  const [allergies, setAllergies] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  useEffect(() => {
    api.get<PatientProfile>('/api/patients/me')
      .then(({ data }) => {
        setProfile(data)
        setName(data.name ?? '')
        setDob(data.dob ? data.dob.slice(0, 10) : '')
        setAllergies(data.allergies ?? '')
      })
      .catch(() => {
        setProfile({ name: null, phone: '', dob: null, allergies: null })
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, string | null> = {}
      if (name.trim())     body.name      = name.trim()
      if (dob.trim())      body.dob       = dob.trim()
      else                 body.dob       = null
      body.allergies = allergies.trim() || null

      await api.put('/api/patients/me', body)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brand.green400} />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing[6] }]}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      <Text style={styles.label}>{t('profile.name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('profile.name')}
        testID="name-input"
      />

      <Text style={styles.label}>{t('profile.dob')}</Text>
      <TextInput
        style={styles.input}
        value={dob}
        onChangeText={setDob}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        testID="dob-input"
      />

      <Text style={styles.label}>{t('profile.allergies')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={allergies}
        onChangeText={setAllergies}
        placeholder={t('profile.allergies')}
        multiline
        numberOfLines={3}
        testID="allergies-input"
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

      <Text style={[styles.label, { marginTop: spacing[6] }]}>{t('profile.language')}</Text>
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
  loading:         { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.base },
  container:       { padding: spacing[6], backgroundColor: colors.surface.base, flexGrow: 1 },
  title:           { fontSize: typography.size.xl, fontFamily: 'DMSerifDisplay', marginBottom: spacing[6], color: colors.text.primary },
  label:           { fontSize: typography.size.md, color: colors.text.secondary, marginBottom: spacing[2], marginTop: spacing[3], fontFamily: 'DMSans' },
  input:           {
    borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.sm,
    padding: spacing[3], fontSize: typography.size.base, color: colors.text.primary,
    fontFamily: 'DMSans', backgroundColor: colors.surface.input,
  },
  multiline:       { minHeight: 80, textAlignVertical: 'top' },
  saveBtn:         {
    backgroundColor: colors.brand.green400, borderRadius: radius.full,
    padding: spacing[4], alignItems: 'center', marginTop: spacing[6],
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
  langRow:         { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  langBtn:         {
    paddingVertical: spacing[2], paddingHorizontal: spacing[4],
    borderWidth: 1, borderColor: colors.surface.border, borderRadius: radius.sm,
  },
  langBtnActive:   { borderColor: colors.surface.borderBrand, backgroundColor: colors.surface.cardBrand },
  langText:        { color: colors.text.secondary, fontFamily: 'DMSansMedium' },
  langTextActive:  { color: colors.text.brand, fontFamily: 'DMSansSemibold' },
  logoutBtn:       {
    marginTop: spacing[8], padding: spacing[4], backgroundColor: colors.status.red,
    borderRadius: radius.full, alignItems: 'center',
  },
  logoutText:      { color: colors.text.primary, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
})
