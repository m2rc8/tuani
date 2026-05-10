import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'

interface MedicationRow {
  name: string
  dose: string
  frequency: string
}

export default function WriteRxScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const [diagnosis, setDiagnosis] = useState('')
  const [diagnosisCode, setDiagnosisCode] = useState('')
  const [medications, setMedications] = useState<MedicationRow[]>([{ name: '', dose: '', frequency: '' }])
  const [instructions, setInstructions] = useState('')
  const [priceLps, setPriceLps] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = diagnosis.trim().length > 0 && medications.some((m) => m.name.trim().length > 0) && !submitting

  const updateMed = (index: number, field: keyof MedicationRow, value: string) => {
    setMedications((prev) => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  const addMedication = () => {
    setMedications((prev) => [...prev, { name: '', dose: '', frequency: '' }])
  }

  const removeMedication = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        diagnosis: diagnosis.trim(),
        medications: medications.filter((m) => m.name.trim().length > 0),
      }
      if (diagnosisCode.trim()) payload.diagnosis_code = diagnosisCode.trim()
      if (instructions.trim()) payload.instructions = instructions.trim()
      if (priceLps.trim()) payload.price_lps = parseFloat(priceLps)

      await api.put(`/api/consultations/${consultationId}/complete`, payload)
      navigation.goBack()
    } catch {
      Alert.alert(t('common.error_generic'))
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>{t('doctor.diagnosis_label')}</Text>
      <TextInput
        style={styles.input}
        value={diagnosis}
        onChangeText={setDiagnosis}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        testID="diagnosis-input"
      />

      <Text style={styles.label}>{t('doctor.diagnosis_code_label')}</Text>
      <TextInput
        style={styles.input}
        value={diagnosisCode}
        onChangeText={setDiagnosisCode}
        testID="diagnosis-code-input"
      />

      <Text style={styles.label}>{t('consultation.medications')}</Text>
      {medications.map((med, i) => (
        <View key={i} style={styles.medRow}>
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('doctor.medication_name')}
            value={med.name}
            onChangeText={(v) => updateMed(i, 'name', v)}
            testID={`med-name-${i}`}
          />
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('doctor.medication_dose')}
            value={med.dose}
            onChangeText={(v) => updateMed(i, 'dose', v)}
            testID={`med-dose-${i}`}
          />
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('doctor.medication_frequency')}
            value={med.frequency}
            onChangeText={(v) => updateMed(i, 'frequency', v)}
            testID={`med-freq-${i}`}
          />
          {medications.length > 1 && (
            <TouchableOpacity onPress={() => removeMedication(i)} testID={`remove-med-${i}`}>
              <Text style={styles.removeText}>{t('doctor.remove_medication')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity style={styles.addMedBtn} onPress={addMedication} testID="add-medication-btn">
        <Text style={styles.addMedText}>{t('doctor.add_medication')}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{t('doctor.instructions_label')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={instructions}
        onChangeText={setInstructions}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        testID="instructions-input"
      />

      <Text style={styles.label}>{t('doctor.price_label')}</Text>
      <TextInput
        style={styles.input}
        value={priceLps}
        onChangeText={setPriceLps}
        keyboardType="numeric"
        testID="price-input"
      />

      <TouchableOpacity
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        testID="submit-btn"
        accessibilityState={{ disabled: !canSubmit }}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitBtnText}>{t('doctor.submit_rx')}</Text>}
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  label: {
    fontSize: 11, color: '#94A3B8', textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 6, marginTop: 16, letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    padding: 12, fontSize: 15, marginBottom: 4,
  },
  multiline: { minHeight: 80 },
  medRow: { marginBottom: 8 },
  medInput: { marginBottom: 4 },
  removeText: { color: '#EF4444', fontSize: 13, textAlign: 'right', marginBottom: 8 },
  addMedBtn: { marginTop: 4, marginBottom: 8 },
  addMedText: { color: '#3B82F6', fontSize: 14, fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#3B82F6', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
