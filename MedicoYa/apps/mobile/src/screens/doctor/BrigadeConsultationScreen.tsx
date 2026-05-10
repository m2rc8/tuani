import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useBrigadeStore } from '../../store/brigadeStore'
import { tokens } from '../../theme/tokens'
import DatePickerField from '../../components/DatePickerField'

const { colors, spacing, radius, typography } = tokens

interface MedRow {
  name: string
  dose: string
  frequency: string
}

export default function BrigadeConsultationScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { local_id } = (route.params ?? {}) as { local_id?: string }
  const { patientCache, offlineQueue, addConsultation } = useBrigadeStore()

  const [phone, setPhone]     = useState('')
  const [dob, setDob]         = useState('')
  const [name, setName]       = useState('')
  const [symptoms, setSymptoms]   = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [referralTo, setReferralTo] = useState('')
  const [meds, setMeds] = useState<MedRow[]>([])

  useEffect(() => {
    if (local_id) {
      const existing = offlineQueue.find(c => c.local_id === local_id)
      if (existing) {
        setPhone(existing.patient_phone ?? '')
        setDob(existing.patient_dob ?? '')
        setName(existing.patient_name)
        setSymptoms(existing.symptoms_text ?? '')
        setDiagnosis(existing.diagnosis ?? '')
        setReferralTo(existing.referral_to ?? '')
        setMeds(existing.medications)
      }
    }
  }, [local_id, offlineQueue])

  const handlePhoneBlur = useCallback(() => {
    if (name) return
    const cached = patientCache.find(p => p.phone === phone)
    if (cached) setName(cached.name)
  }, [phone, name, patientCache])

  const handleSave = useCallback(() => {
    if (!name.trim() || (!phone.trim() && !dob.trim())) {
      Alert.alert(t('brigade.error_required'))
      return
    }
    addConsultation({
      patient_phone: phone.trim() || undefined,
      patient_dob:   dob.trim() || undefined,
      patient_name:  name.trim(),
      symptoms_text: symptoms.trim() || undefined,
      diagnosis:     diagnosis.trim() || undefined,
      referral_to:   referralTo.trim() || undefined,
      medications:   meds.filter(m => m.name && m.dose && m.frequency),
      created_at:    new Date().toISOString(),
    })
    navigation.goBack()
  }, [phone, dob, name, symptoms, diagnosis, referralTo, meds, addConsultation, navigation, t])

  const addMed = useCallback(() => {
    setMeds(prev => [...prev, { name: '', dose: '', frequency: '' }])
  }, [])

  const removeMed = useCallback((idx: number) => {
    setMeds(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const updateMed = useCallback((idx: number, field: keyof MedRow, value: string) => {
    setMeds(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }, [])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>{t('brigade.patient_phone_optional')}</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        onBlur={handlePhoneBlur}
        keyboardType="phone-pad"
        testID="phone-input"
      />

      <Text style={styles.label}>{t('brigade.patient_name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        testID="name-input"
      />

      {!phone.trim() && (
        <DatePickerField
          label={t('brigade.patient_dob')}
          value={dob}
          onChange={setDob}
          maxDate={new Date()}
        />
      )}

      <Text style={styles.label}>{t('brigade.symptoms')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={symptoms}
        onChangeText={setSymptoms}
        multiline
        numberOfLines={3}
        testID="symptoms-input"
      />

      <Text style={styles.label}>{t('brigade.diagnosis')}</Text>
      <TextInput
        style={styles.input}
        value={diagnosis}
        onChangeText={setDiagnosis}
        testID="diagnosis-input"
      />

      <Text style={styles.label}>{t('doctor.referral_label')}</Text>
      <TextInput
        style={styles.input}
        value={referralTo}
        onChangeText={setReferralTo}
        placeholder={t('doctor.referral_placeholder')}
        testID="referral-input"
      />

      <Text style={styles.label}>{t('brigade.medications')}</Text>
      {meds.map((m, i) => (
        <View key={i} style={styles.medRow}>
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('brigade.med_name')}
            value={m.name}
            onChangeText={v => updateMed(i, 'name', v)}
          />
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('brigade.med_dose')}
            value={m.dose}
            onChangeText={v => updateMed(i, 'dose', v)}
          />
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('brigade.med_frequency')}
            value={m.frequency}
            onChangeText={v => updateMed(i, 'frequency', v)}
          />
          <TouchableOpacity onPress={() => removeMed(i)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>{t('brigade.remove_medication')}</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={addMed} style={styles.addMedBtn}>
        <Text style={styles.addMedText}>{t('brigade.add_medication')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} testID="save-btn">
        <Text style={styles.saveBtnText}>{t('brigade.save_offline')}</Text>
      </TouchableOpacity>
      <Text style={styles.willSync}>{t('brigade.will_sync')}</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.base },
  content: { padding: spacing[4] },
  label: { fontSize: typography.size.sm, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing[1], marginTop: spacing[3], fontFamily: 'DMSansSemibold' },
  input: {
    borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.sm, padding: spacing[3],
    fontSize: typography.size.base, backgroundColor: colors.surface.input, marginBottom: spacing[1],
    fontFamily: 'DMSans', color: colors.text.primary,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  medRow: { marginBottom: spacing[2] },
  medInput: { marginBottom: spacing[1] },
  removeBtn: { alignSelf: 'flex-start', marginBottom: spacing[1] },
  removeBtnText: { color: colors.status.red, fontSize: typography.size.sm, fontFamily: 'DMSans' },
  addMedBtn: { marginTop: spacing[1], marginBottom: spacing[4] },
  addMedText: { color: colors.text.brand, fontFamily: 'DMSansSemibold' },
  saveBtn: { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[4], alignItems: 'center', marginTop: spacing[2] },
  saveBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
  willSync: { fontSize: typography.size.sm, color: colors.text.secondary, textAlign: 'center', marginTop: spacing[2], fontFamily: 'DMSans' },
})
