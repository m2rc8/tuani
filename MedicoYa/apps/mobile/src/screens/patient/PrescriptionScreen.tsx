import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput,
} from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import type { ConsultationDetail } from '../../lib/types'

export default function PrescriptionScreen({ route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }

  const [detail,        setDetail]        = useState<ConsultationDetail | null>(null)
  const [selectedStars, setSelectedStars] = useState(0)
  const [comment,       setComment]       = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [submitted,     setSubmitted]     = useState(false)

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

  const alreadyRated = detail.rating !== null || submitted

  async function submitRating() {
    if (selectedStars === 0 || submitting) return
    setSubmitting(true)
    try {
      await api.post('/api/ratings', {
        consultation_id: consultationId,
        stars:   selectedStars,
        comment,
      })
      setSubmitted(true)
    } catch {
      // silent — prescription stays visible
    } finally {
      setSubmitting(false)
    }
  }

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

      <View style={styles.ratingSection}>
        {alreadyRated ? (
          <Text style={styles.ratingThanks}>{t('consultation.rate_thanks')}</Text>
        ) : (
          <>
            <Text style={styles.ratingTitle}>{t('consultation.rate_title')}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(i => (
                <TouchableOpacity
                  key={i}
                  testID={`star-${i}`}
                  onPress={() => setSelectedStars(i)}
                >
                  <Text style={[styles.star, selectedStars >= i && styles.starActive]}>
                    {selectedStars >= i ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              testID="rating-comment"
              style={styles.commentInput}
              placeholder={t('consultation.rate_comment')}
              value={comment}
              onChangeText={setComment}
              maxLength={300}
              multiline
            />
            <TouchableOpacity
              testID="rating-submit"
              style={[styles.submitBtn, (selectedStars === 0 || submitting) && styles.submitDisabled]}
              onPress={submitRating}
              disabled={selectedStars === 0 || submitting}
            >
              <Text style={styles.submitText}>{t('consultation.rate_submit')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loading:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container:     { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  heading:       { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  section:       { marginBottom: 20 },
  label:         {
    fontSize: 11, color: '#94A3B8', textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 6, letterSpacing: 0.5,
  },
  value:         { fontSize: 17, color: '#1E293B', fontWeight: '600' },
  medication:    { fontSize: 15, color: '#334155', marginBottom: 4 },
  qrContainer:   {
    alignItems: 'center', padding: 20,
    backgroundColor: '#F8FAFC', borderRadius: 12, marginVertical: 20,
  },
  validUntil:    { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  ratingSection: { marginTop: 32, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 24 },
  ratingTitle:   { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 12 },
  starsRow:      { flexDirection: 'row', marginBottom: 16 },
  star:          { fontSize: 32, color: '#CBD5E1', marginRight: 8 },
  starActive:    { color: '#F59E0B' },
  commentInput:  {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    padding: 12, minHeight: 80, fontSize: 15, color: '#1E293B', marginBottom: 16,
  },
  submitBtn:     { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  submitDisabled:{ opacity: 0.5 },
  submitText:    { color: '#fff', fontWeight: '600', fontSize: 16 },
  ratingThanks:  { fontSize: 16, color: '#10B981', fontWeight: '600', textAlign: 'center' },
})
