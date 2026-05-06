import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import QRCode from 'react-qr-code'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import type { ConsultationDetail } from '../../lib/types'

export default function PrescriptionScreen({ route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const [detail, setDetail] = useState<ConsultationDetail | null>(null)

  useEffect(() => {
    api.get<ConsultationDetail>(`/api/consultations/${consultationId}`)
      .then(({ data }) => setDetail(data))
      .catch(() => {})
  }, [consultationId])

  if (!detail) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  const { diagnosis, prescription } = detail
  if (!prescription) return null

  const validUntil = prescription.valid_until
    ? new Date(prescription.valid_until).toLocaleDateString()
    : '—'

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{t('consultation.prescription_title')}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>{t('consultation.diagnosis')}</Text>
        <Text style={styles.value}>{diagnosis}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t('consultation.medications')}</Text>
        {prescription.medications.map((med, i) => (
          <Text key={i} style={styles.medication}>
            {med.name} — {med.dose} — {med.frequency}
          </Text>
        ))}
      </View>

      {prescription.instructions && (
        <View style={styles.section}>
          <Text style={styles.value}>{prescription.instructions}</Text>
        </View>
      )}

      <View style={styles.qrContainer}>
        <QRCode value={`MEDICOYA:${prescription.qr_code}`} size={180} />
      </View>

      <Text style={styles.validUntil}>
        {t('consultation.valid_until')}: {validUntil}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  section: { marginBottom: 20 },
  label: {
    fontSize: 11, color: '#94A3B8', textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 6, letterSpacing: 0.5,
  },
  value: { fontSize: 17, color: '#1E293B', fontWeight: '600' },
  medication: { fontSize: 15, color: '#334155', marginBottom: 4 },
  qrContainer: {
    alignItems: 'center', padding: 20,
    backgroundColor: '#F8FAFC', borderRadius: 12, marginVertical: 20,
  },
  validUntil: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
})
