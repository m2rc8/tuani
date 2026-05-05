import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import { useConsultationStore } from '../../store/consultationStore'
import type { ConsultationDetail } from '../../lib/types'

export default function WaitingScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const token = useAuthStore((s) => s.token)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const { setStatus, clear } = useConsultationStore()
  const [symptomsText, setSymptomsText] = useState<string | null>(null)

  const handleConsultationUpdated = useCallback(
    async (data: { id: string; status: string }) => {
      if (data.id !== consultationId) return
      if (data.status === 'active') {
        await setStatus('active')
        navigation.replace('ConsultationScreen', { consultationId })
      }
      if (data.status === 'rejected' || data.status === 'cancelled') {
        await clear()
        Alert.alert(t('common.error_generic'))
        navigation.goBack()
      }
    },
    [consultationId, setStatus, clear, navigation, t],
  )

  useEffect(() => {
    socketService.connect(baseURL, token ?? '')
    socketService.emit('join_consultation', { consultation_id: consultationId })
    socketService.on('consultation_updated', handleConsultationUpdated)

    api.get<ConsultationDetail>(`/api/consultations/${consultationId}`)
      .then(({ data }) => setSymptomsText(data.symptoms_text))
      .catch(() => {})

    return () => {
      socketService.off('consultation_updated', handleConsultationUpdated)
    }
  }, [consultationId, handleConsultationUpdated, baseURL, token])

  const handleCancel = async () => {
    try {
      await api.put(`/api/consultations/${consultationId}/cancel`)
      await clear()
      navigation.goBack()
    } catch {
      Alert.alert(t('common.error_generic'))
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('consultation.waiting_title')}</Text>
      <ActivityIndicator size="large" color="#3B82F6" style={styles.spinner} />
      <Text style={styles.subtitle}>{t('consultation.waiting_subtitle')}</Text>

      {symptomsText && (
        <View style={styles.symptomsBox}>
          <Text style={styles.symptomsLabel}>{t('consultation.your_symptoms')}</Text>
          <Text style={styles.symptomsText}>{symptomsText}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={handleCancel}
        testID="cancel-btn"
      >
        <Text style={styles.cancelText}>{t('consultation.cancel')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  spinner: { marginBottom: 16 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 32 },
  symptomsBox: {
    width: '100%', backgroundColor: '#F8FAFC', borderRadius: 10,
    padding: 16, marginBottom: 32,
  },
  symptomsLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' },
  symptomsText: { fontSize: 15, color: '#334155' },
  cancelBtn: {
    padding: 14, borderWidth: 1, borderColor: '#EF4444',
    borderRadius: 10, alignItems: 'center', width: '100%',
  },
  cancelText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
})
