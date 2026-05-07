import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useBrigadeStore } from '../../store/brigadeStore'

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
  const [name, setName]       = useState('')
  const [symptoms, setSymptoms]   = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [meds, setMeds] = useState<MedRow[]>([])

  useEffect(() => {
    if (local_id) {
      const existing = offlineQueue.find(c => c.local_id === local_id)
      if (existing) {
        setPhone(existing.patient_phone)
        setName(existing.patient_name)
        setSymptoms(existing.symptoms_text ?? '')
        setDiagnosis(existing.diagnosis ?? '')
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
    if (!phone.trim() || !name.trim()) {
      Alert.alert(t('brigade.error_required'))
      return
    }
    addConsultation({
      patient_phone: phone.trim(),
      patient_name:  name.trim(),
      symptoms_text: symptoms.trim() || undefined,
      diagnosis:     diagnosis.trim() || undefined,
      medications:   meds.filter(m => m.name && m.dose && m.frequency),
      created_at:    new Date().toISOString(),
    })
    navigation.goBack()
  }, [phone, name, symptoms, diagnosis, meds, addConsultation, navigation, t])

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
      <Text style={styles.label}>{t('brigade.patient_phone')}</Text>
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  label: { fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12,
    fontSize: 15, backgroundColor: '#fff', marginBottom: 4,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  medRow: { marginBottom: 8 },
  medInput: { marginBottom: 4 },
  removeBtn: { alignSelf: 'flex-start', marginBottom: 4 },
  removeBtnText: { color: '#EF4444', fontSize: 12 },
  addMedBtn: { marginTop: 4, marginBottom: 16 },
  addMedText: { color: '#3B82F6', fontWeight: '600' },
  saveBtn: { backgroundColor: '#EF4444', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  willSync: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 8 },
})
