import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useConsultationStore } from '../../store/consultationStore'
import type { AvailableDoctor } from '../../lib/types'

const MAX_CHARS = 500

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation()
  const { activeConsultationId, status, setActive } = useConsultationStore()
  const [symptoms, setSymptoms] = useState('')
  const [doctorCount, setDoctorCount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchDoctors = useCallback(async () => {
    try {
      const { data } = await api.get<AvailableDoctor[]>('/api/doctors/available')
      setDoctorCount(data.length)
    } catch {
      setDoctorCount(0)
    }
  }, [])

  useEffect(() => {
    if (activeConsultationId && status === 'pending') {
      navigation.navigate('WaitingScreen', { consultationId: activeConsultationId })
      return
    }
    if (activeConsultationId && status === 'active') {
      navigation.navigate('ConsultationScreen', { consultationId: activeConsultationId })
      return
    }
    fetchDoctors()
    const interval = setInterval(fetchDoctors, 30_000)
    return () => clearInterval(interval)
  }, [activeConsultationId, status])

  const canSubmit = symptoms.trim().length > 0 && (doctorCount ?? 0) > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('symptoms_text', symptoms.trim())
      const { data } = await api.post<{ id: string }>('/api/consultations', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await setActive(data.id, 'pending')
      navigation.navigate('WaitingScreen', { consultationId: data.id })
    } catch {
      Alert.alert(t('common.error_generic'))
      setSubmitting(false)
    }
  }

  const doctorBadge = doctorCount === null
    ? null
    : doctorCount === 0
      ? t('consultation.no_doctors')
      : t('consultation.doctors_available', { count: doctorCount })

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('nav.home')}</Text>

      {doctorBadge && (
        <View style={[styles.badge, doctorCount === 0 && styles.badgeWarn]} testID="doctor-badge">
          <Text style={[styles.badgeText, doctorCount === 0 && styles.badgeTextWarn]}>
            {doctorBadge}
          </Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder={t('consultation.symptoms_placeholder')}
        value={symptoms}
        onChangeText={(v) => setSymptoms(v.slice(0, MAX_CHARS))}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        testID="symptoms-input"
      />
      <Text style={styles.counter}>
        {t('consultation.chars_remaining', { count: MAX_CHARS - symptoms.length })}
      </Text>

      <TouchableOpacity
        style={[styles.btn, !canSubmit && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        testID="submit-btn"
        accessibilityState={{ disabled: !canSubmit }}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{t('consultation.start_cta')}</Text>}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  badge: {
    backgroundColor: '#DCFCE7', borderRadius: 8, padding: 10, marginBottom: 16, alignItems: 'center',
  },
  badgeWarn: { backgroundColor: '#FEF9C3' },
  badgeText: { fontSize: 14, color: '#166534', fontWeight: '600' },
  badgeTextWarn: { color: '#854D0E' },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    padding: 12, fontSize: 15, minHeight: 140, marginBottom: 6,
  },
  counter: { fontSize: 12, color: '#94A3B8', marginBottom: 20, textAlign: 'right' },
  btn: {
    backgroundColor: '#3B82F6', borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#93C5FD' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
