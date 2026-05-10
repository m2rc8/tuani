import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, AppState, AppStateStatus,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import { useConsultationStore } from '../../store/consultationStore'
import type { ConsultationDetail } from '../../lib/types'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

export default function WaitingScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const token = useAuthStore((s) => s.token)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const { setStatus, clear } = useConsultationStore()
  const [symptomsText, setSymptomsText] = useState<string | null>(null)
  const appState    = useRef<AppStateStatus>(AppState.currentState)
  const leavingRef  = useRef(false)

  const handleConsultationUpdated = useCallback(
    async (data: { id: string; status: string }) => {
      if (data.id !== consultationId) return
      if (data.status === 'active') {
        await setStatus('active')
        navigation.replace('ConsultationScreen', { consultationId })
      }
      if (data.status === 'rejected' || data.status === 'cancelled') {
        if (leavingRef.current) return
        leavingRef.current = true
        await clear()
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
      .then(({ data }) => {
        setSymptomsText(data.symptoms_text)
        if (data.status === 'active') {
          setStatus('active')
          navigation.replace('ConsultationScreen', { consultationId })
        }
      })
      .catch(() => {})

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        api.get<ConsultationDetail>(`/api/consultations/${consultationId}`)
          .then(({ data }) => {
            if (data.status === 'active') {
              setStatus('active')
              navigation.replace('ConsultationScreen', { consultationId })
            }
          })
          .catch(() => {})
      }
      appState.current = next
    })

    return () => {
      socketService.off('consultation_updated', handleConsultationUpdated)
      sub.remove()
    }
  }, [consultationId, handleConsultationUpdated, baseURL, token])

  const handleCancel = async () => {
    if (leavingRef.current) return
    leavingRef.current = true
    try {
      await api.put(`/api/consultations/${consultationId}/cancel`)
    } catch (err: any) {
      if (err?.response?.status !== 409) {
        leavingRef.current = false
        Alert.alert(t('common.error_generic'))
        return
      }
    }
    await clear()
    navigation.goBack()
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('consultation.waiting_title')}</Text>
      <ActivityIndicator size="large" color={colors.brand.green400} style={styles.spinner} />
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
  container: { flex: 1, padding: spacing[6], backgroundColor: colors.surface.base, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.size.lg, fontFamily: 'DMSerifDisplay', marginBottom: spacing[6], textAlign: 'center', color: colors.text.primary },
  spinner: { marginBottom: spacing[4] },
  subtitle: { fontSize: typography.size.md, color: colors.text.secondary, textAlign: 'center', marginBottom: spacing[8], fontFamily: 'DMSans' },
  symptomsBox: {
    width: '100%', backgroundColor: colors.surface.cardBrand, borderRadius: radius.md,
    padding: spacing[4], marginBottom: spacing[8],
  },
  symptomsLabel: { fontSize: typography.size.xs, color: colors.text.secondary, marginBottom: spacing[1], textTransform: 'uppercase', fontFamily: 'DMSansSemibold' },
  symptomsText: { fontSize: typography.size.base, color: colors.text.primary, fontFamily: 'DMSans' },
  cancelBtn: {
    padding: spacing[4], borderWidth: 1, borderColor: colors.status.red,
    borderRadius: radius.full, alignItems: 'center', width: '100%',
  },
  cancelText: { color: colors.status.red, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
})
