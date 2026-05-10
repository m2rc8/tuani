import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
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
            ? <ActivityIndicator color={colors.text.inverse} />
            : <Text style={styles.submitBtnText}>{t('doctor.submit_rx')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing[6], backgroundColor: colors.surface.base, flexGrow: 1 },
  label: {
    fontSize: typography.size.xs, color: colors.text.secondary, textTransform: 'uppercase',
    fontFamily: 'DMSansSemibold', marginBottom: spacing[2], marginTop: spacing[4], letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.md,
    padding: spacing[3], fontSize: typography.size.base, marginBottom: spacing[1],
    fontFamily: 'DMSans', backgroundColor: colors.surface.input, color: colors.text.primary,
  },
  multiline: { minHeight: 80 },
  medRow: { marginBottom: spacing[2] },
  medInput: { marginBottom: spacing[1] },
  removeText: { color: colors.status.red, fontSize: typography.size.md, textAlign: 'right', marginBottom: spacing[2], fontFamily: 'DMSans' },
  addMedBtn: { marginTop: spacing[1], marginBottom: spacing[2] },
  addMedText: { color: colors.text.brand, fontSize: typography.size.md, fontFamily: 'DMSansSemibold' },
  submitBtn: {
    backgroundColor: colors.brand.green400, borderRadius: radius.full,
    padding: spacing[4], alignItems: 'center', marginTop: spacing[6],
  },
  submitBtnDisabled: { backgroundColor: colors.brand.green400, opacity: 0.4 },
  submitBtnText: { color: colors.text.inverse, fontSize: typography.size.base, fontFamily: 'DMSansSemibold' },
})
