import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

interface PatientProfile {
  name:      string | null
  phone:     string
  dob:       string | null
  allergies: string | null
}

export default function PatientProfileScreen() {
  const { t } = useTranslation()
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
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveBtnText}>{saved ? t('profile.saved') : t('profile.save')}</Text>
        }
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 24 }]}>{t('profile.language')}</Text>
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
  loading:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container:       { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  title:           { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  label:           { fontSize: 14, color: '#64748B', marginBottom: 6, marginTop: 12 },
  input:           {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
    padding: 12, fontSize: 15, color: '#1E293B',
  },
  multiline:       { minHeight: 80, textAlignVertical: 'top' },
  saveBtn:         {
    backgroundColor: '#3B82F6', borderRadius: 8,
    padding: 14, alignItems: 'center', marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  langRow:         { flexDirection: 'row', gap: 8, marginBottom: 8 },
  langBtn:         {
    paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6,
  },
  langBtnActive:   { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  langText:        { color: '#64748B', fontWeight: '500' },
  langTextActive:  { color: '#3B82F6', fontWeight: '600' },
  logoutBtn:       {
    marginTop: 32, padding: 14, backgroundColor: '#EF4444',
    borderRadius: 8, alignItems: 'center',
  },
  logoutText:      { color: '#fff', fontWeight: '600', fontSize: 16 },
})
