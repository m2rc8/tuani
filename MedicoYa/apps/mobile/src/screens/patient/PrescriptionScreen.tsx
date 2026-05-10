import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput,
} from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import type { ConsultationDetail } from '../../lib/types'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

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
        <ActivityIndicator size="large" color={colors.brand.green400} />
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
  container:     { padding: spacing[6], backgroundColor: colors.ui.white, flexGrow: 1 },
  heading:       { fontSize: typography.size.lg, fontFamily: 'DMSerifDisplay', marginBottom: spacing[6] },
  section:       { marginBottom: spacing[6] },
  label:         {
    fontSize: typography.size.xs, color: colors.ui.slate600, textTransform: 'uppercase',
    fontFamily: 'DMSansSemibold', marginBottom: spacing[2], letterSpacing: 0.5,
  },
  value:         { fontSize: 17, color: colors.ui.slate900, fontFamily: 'DMSansSemibold' },
  medication:    { fontSize: typography.size.base, color: colors.ui.slate900, marginBottom: spacing[1], fontFamily: 'DMSans' },
  qrContainer:   {
    alignItems: 'center', padding: spacing[6],
    backgroundColor: colors.brand.green50, borderRadius: radius.md, marginVertical: spacing[6],
  },
  validUntil:    { fontSize: typography.size.md, color: colors.ui.slate600, textAlign: 'center', fontFamily: 'DMSans' },
  ratingSection: { marginTop: spacing[8], borderTopWidth: 1, borderTopColor: colors.ui.slate200, paddingTop: spacing[6] },
  ratingTitle:   { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.ui.slate900, marginBottom: spacing[3] },
  starsRow:      { flexDirection: 'row', marginBottom: spacing[4] },
  star:          { fontSize: 32, color: colors.ui.slate200, marginRight: spacing[2] },
  starActive:    { color: colors.status.amber },
  commentInput:  {
    borderWidth: 1, borderColor: colors.ui.slate200, borderRadius: radius.sm,
    padding: spacing[3], minHeight: 80, fontSize: typography.size.base, color: colors.ui.slate900, marginBottom: spacing[4],
    fontFamily: 'DMSans',
  },
  submitBtn:     { backgroundColor: colors.brand.green400, borderRadius: radius.sm, paddingVertical: spacing[3], alignItems: 'center' },
  submitDisabled:{ opacity: 0.5 },
  submitText:    { color: colors.ui.white, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
  ratingThanks:  { fontSize: typography.size.base, color: colors.brand.green400, fontFamily: 'DMSansSemibold', textAlign: 'center' },
})
