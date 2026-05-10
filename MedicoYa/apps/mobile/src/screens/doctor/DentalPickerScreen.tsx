import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

export default function DentalPickerScreen({ navigation }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [mode,          setMode]          = useState<'adult' | 'minor'>('adult')
  const [phone,         setPhone]         = useState('')
  const [firstName,     setFirstName]     = useState('')
  const [lastName,      setLastName]      = useState('')
  const [dob,           setDob]           = useState('')
  const [guardianName,  setGuardianName]  = useState('')
  const [loading,       setLoading]       = useState(false)

  const canSubmitAdult = phone.trim().length > 0
  const canSubmitMinor = firstName.trim().length > 0 && lastName.trim().length > 0 && dob.trim().length === 10

  async function handleAdult() {
    setLoading(true)
    try {
      const { data } = await api.get<{ id: string }>(`/api/patients/by-phone/${encodeURIComponent(phone.trim())}`)
      navigation.navigate('DentalRecordScreen', { patientId: data.id })
    } catch {
      Alert.alert(t('dental.patient_not_found'), t('dental.check_phone'))
    } finally {
      setLoading(false)
    }
  }

  async function handleMinor() {
    setLoading(true)
    try {
      const { data } = await api.post<{ patient_id: string }>('/api/dental/patients/minor', {
        first_name:    firstName.trim(),
        last_name:     lastName.trim(),
        dob:           dob.trim(),
        guardian_name: guardianName.trim() || undefined,
      })
      navigation.navigate('DentalRecordScreen', { patientId: data.patient_id })
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing[6] }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Odontología</Text>
        <Text style={styles.subtitle}>{t('dental.subtitle')}</Text>

        {/* Mode toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'adult' && styles.toggleBtnActive]}
            onPress={() => setMode('adult')}
          >
            <Text style={[styles.toggleText, mode === 'adult' && styles.toggleTextActive]}>{t('dental.adult')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'minor' && styles.toggleBtnActive]}
            onPress={() => setMode('minor')}
          >
            <Text style={[styles.toggleText, mode === 'minor' && styles.toggleTextActive]}>{t('dental.minor')}</Text>
          </TouchableOpacity>
        </View>

        {mode === 'adult' ? (
          <>
            <Text style={styles.label}>{t('dental.phone_label')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+504XXXXXXXX"
              placeholderTextColor={colors.text.muted}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, (!canSubmitAdult || loading) && styles.btnDisabled]}
              onPress={handleAdult}
              disabled={!canSubmitAdult || loading}
            >
              {loading ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={styles.btnText}>{t('dental.start_record')}</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>{t('profile.first_name')}</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder={t('profile.first_name')} placeholderTextColor={colors.text.muted} autoFocus />

            <Text style={styles.label}>{t('profile.last_name')}</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder={t('profile.last_name')} placeholderTextColor={colors.text.muted} />

            <Text style={styles.label}>{t('profile.dob')} (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={dob} onChangeText={setDob} placeholder="2015-06-20" placeholderTextColor={colors.text.muted} keyboardType="numbers-and-punctuation" />

            <Text style={styles.label}>{t('dental.guardian_name')}</Text>
            <TextInput style={styles.input} value={guardianName} onChangeText={setGuardianName} placeholder={t('dental.guardian_placeholder')} placeholderTextColor={colors.text.muted} />

            <TouchableOpacity
              style={[styles.btn, (!canSubmitMinor || loading) && styles.btnDisabled]}
              onPress={handleMinor}
              disabled={!canSubmitMinor || loading}
            >
              {loading ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={styles.btnText}>{t('dental.start_record')}</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:       { padding: spacing[6], backgroundColor: colors.surface.base, flexGrow: 1 },
  title:           { fontSize: typography.size.xl, fontFamily: 'DMSerifDisplay', color: colors.text.primary, marginBottom: spacing[2] },
  subtitle:        { color: colors.text.secondary, fontFamily: 'DMSans', fontSize: typography.size.md, marginBottom: spacing[6] },
  toggle:          { flexDirection: 'row', marginBottom: spacing[6], borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.surface.border },
  toggleBtn:       { flex: 1, paddingVertical: spacing[3], alignItems: 'center', backgroundColor: colors.surface.input },
  toggleBtnActive: { backgroundColor: colors.brand.green400 },
  toggleText:      { fontFamily: 'DMSansMedium', fontSize: typography.size.md, color: colors.text.secondary },
  toggleTextActive:{ color: colors.text.inverse },
  label:           { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: 'DMSans', marginBottom: spacing[1], marginTop: spacing[3] },
  input:           { borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.md, padding: spacing[3], color: colors.text.primary, fontFamily: 'DMSans', fontSize: typography.size.base, backgroundColor: colors.surface.input, marginBottom: spacing[1] },
  btn:             { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[4], alignItems: 'center', marginTop: spacing[6] },
  btnDisabled:     { opacity: 0.4 },
  btnText:         { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
})
