import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { tokens } from '../../theme/tokens'
import DatePickerField from '../../components/DatePickerField'

const { colors, spacing, radius, typography } = tokens

interface MinorResult {
  patient_id: string
  name: string
}

export default function DentalPickerScreen({ navigation }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [mode,          setMode]          = useState<'adult' | 'minor'>('adult')
  const [loading,       setLoading]       = useState(false)

  // Adult
  const [phone, setPhone] = useState('')

  // Minor search
  const [searchQuery,   setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<MinorResult[] | null>(null)
  const [searching,     setSearching]     = useState(false)

  // Minor create
  const [showCreate,    setShowCreate]    = useState(false)
  const [firstName,     setFirstName]     = useState('')
  const [lastName,      setLastName]      = useState('')
  const [dob,           setDob]           = useState('')
  const [guardianName,  setGuardianName]  = useState('')

  const canSubmitAdult  = phone.trim().length > 0
  const canSubmitMinor  = firstName.trim().length > 0 && lastName.trim().length > 0 && dob.length === 10

  async function resolveFile(patientId: string, patientName?: string) {
    try {
      let fileId: string
      try {
        const { data } = await api.get<{ id: string }>(`/api/dental/files/by-patient/${patientId}`)
        fileId = data.id
      } catch (err: any) {
        if (err?.response?.status === 404) {
          const { data } = await api.post<{ id: string }>('/api/dental/files', { patient_id: patientId })
          fileId = data.id
        } else throw err
      }
      navigation.navigate('DentalExpedienteScreen', { fileId, patientName })
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setLoading(false)
    }
  }

  async function handleAdult() {
    setLoading(true)
    try {
      const { data } = await api.get<{ id: string; name?: string }>(`/api/patients/by-phone/${encodeURIComponent(phone.trim())}`)
      await resolveFile(data.id, data.name ?? undefined)
    } catch {
      Alert.alert(t('dental.patient_not_found'), t('dental.check_phone'))
      setLoading(false)
    }
  }

  async function handleSearchMinor() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const { data } = await api.get<MinorResult[]>(`/api/dental/patients/minor/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchResults(data)
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setSearching(false)
    }
  }

  async function handleCreateMinor() {
    setLoading(true)
    try {
      const { data } = await api.post<{ patient_id: string }>('/api/dental/patients/minor', {
        first_name:    firstName.trim(),
        last_name:     lastName.trim(),
        dob:           dob.trim(),
        guardian_name: guardianName.trim() || undefined,
      })
      await resolveFile(data.patient_id, `${firstName.trim()} ${lastName.trim()}`)
    } catch {
      Alert.alert(t('common.error_generic'))
      setLoading(false)
    }
  }

  function resetMinor() {
    setSearchQuery('')
    setSearchResults(null)
    setShowCreate(false)
    setFirstName('')
    setLastName('')
    setDob('')
    setGuardianName('')
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
            onPress={() => { setMode('adult'); resetMinor() }}
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
        ) : showCreate ? (
          <>
            <Text style={styles.sectionHeader}>{t('dental.new_minor')}</Text>

            <Text style={styles.label}>{t('profile.first_name')}</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder={t('profile.first_name')} placeholderTextColor={colors.text.muted} autoFocus />

            <Text style={styles.label}>{t('profile.last_name')}</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder={t('profile.last_name')} placeholderTextColor={colors.text.muted} />

            <DatePickerField
              label={t('profile.dob')}
              value={dob}
              onChange={setDob}
              maxDate={new Date()}
            />

            <Text style={styles.label}>{t('dental.guardian_name')}</Text>
            <TextInput style={styles.input} value={guardianName} onChangeText={setGuardianName} placeholder={t('dental.guardian_placeholder')} placeholderTextColor={colors.text.muted} />

            <TouchableOpacity
              style={[styles.btn, (!canSubmitMinor || loading) && styles.btnDisabled]}
              onPress={handleCreateMinor}
              disabled={!canSubmitMinor || loading}
            >
              {loading ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={styles.btnText}>{t('dental.start_record')}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backLink} onPress={() => setShowCreate(false)}>
              <Text style={styles.backLinkText}>← {t('dental.search_existing')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.sectionHeader}>{t('dental.search_minor_title')}</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.input, styles.searchInput]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('dental.search_minor_placeholder')}
                placeholderTextColor={colors.text.muted}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={handleSearchMinor}
              />
              <TouchableOpacity
                style={[styles.searchBtn, (!searchQuery.trim() || searching) && styles.btnDisabled]}
                onPress={handleSearchMinor}
                disabled={!searchQuery.trim() || searching}
              >
                {searching ? <ActivityIndicator color={colors.text.inverse} size="small" /> : <Text style={styles.searchBtnText}>{t('dental.search_btn')}</Text>}
              </TouchableOpacity>
            </View>

            {searchResults !== null && (
              searchResults.length === 0 ? (
                <View style={styles.noResultsBox}>
                  <Text style={styles.noResultsText}>{t('dental.minor_not_found')}</Text>
                  <TouchableOpacity style={styles.btn} onPress={() => setShowCreate(true)}>
                    <Text style={styles.btnText}>{t('dental.create_minor')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {searchResults.map(r => (
                    <TouchableOpacity
                      key={r.patient_id}
                      style={styles.resultCard}
                      onPress={() => { setLoading(true); resolveFile(r.patient_id, r.name ?? undefined) }}
                    >
                      <Text style={styles.resultName}>{r.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.createNewLink} onPress={() => setShowCreate(true)}>
                    <Text style={styles.createNewLinkText}>+ {t('dental.create_minor')}</Text>
                  </TouchableOpacity>
                </>
              )
            )}

            {searchResults === null && (
              <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => setShowCreate(true)}>
                <Text style={styles.btnOutlineText}>+ {t('dental.create_minor')}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:        { padding: spacing[6], backgroundColor: colors.surface.base, flexGrow: 1 },
  title:            { fontSize: typography.size.xl, fontFamily: 'DMSerifDisplay', color: colors.text.primary, marginBottom: spacing[2] },
  subtitle:         { color: colors.text.secondary, fontFamily: 'DMSans', fontSize: typography.size.md, marginBottom: spacing[6] },
  sectionHeader:    { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginBottom: spacing[4] },
  toggle:           { flexDirection: 'row', marginBottom: spacing[6], borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.surface.border },
  toggleBtn:        { flex: 1, paddingVertical: spacing[3], alignItems: 'center', backgroundColor: colors.surface.input },
  toggleBtnActive:  { backgroundColor: colors.brand.green400 },
  toggleText:       { fontFamily: 'DMSansMedium', fontSize: typography.size.md, color: colors.text.secondary },
  toggleTextActive: { color: colors.text.inverse },
  label:            { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: 'DMSans', marginBottom: spacing[1], marginTop: spacing[3] },
  input:            { borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.md, padding: spacing[3], color: colors.text.primary, fontFamily: 'DMSans', fontSize: typography.size.base, backgroundColor: colors.surface.input, marginBottom: spacing[1] },
  btn:              { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[4], alignItems: 'center', marginTop: spacing[4] },
  btnDisabled:      { opacity: 0.4 },
  btnText:          { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
  btnOutline:       { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.brand.green400 },
  btnOutlineText:   { color: colors.brand.green400, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
  searchRow:        { flexDirection: 'row', gap: spacing[2], alignItems: 'center', marginBottom: spacing[3] },
  searchInput:      { flex: 1, marginBottom: 0 },
  searchBtn:        { backgroundColor: colors.brand.green400, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  searchBtnText:    { color: colors.text.inverse, fontFamily: 'DMSansSemibold' },
  noResultsBox:     { backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[4], marginBottom: spacing[3] },
  noResultsText:    { color: colors.text.secondary, fontFamily: 'DMSans', marginBottom: spacing[3] },
  resultCard:       { backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[4], marginBottom: spacing[2], borderWidth: 1, borderColor: colors.surface.border },
  resultName:       { color: colors.text.primary, fontFamily: 'DMSansMedium', fontSize: typography.size.base },
  createNewLink:    { marginTop: spacing[2], alignItems: 'center' },
  createNewLinkText:{ color: colors.text.brand, fontFamily: 'DMSansSemibold' },
  backLink:         { marginTop: spacing[4], alignItems: 'center' },
  backLinkText:     { color: colors.text.secondary, fontFamily: 'DMSans' },
})
