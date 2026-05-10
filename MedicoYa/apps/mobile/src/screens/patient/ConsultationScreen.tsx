import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import { useConsultationStore } from '../../store/consultationStore'
import type { ConsultationDetail, Message, Prescription } from '../../lib/types'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

interface PrescriptionCardProps {
  prescription: Prescription
  diagnosis: string | null
  referralTo?: string | null
  onView: () => void
}

function PrescriptionCard({ prescription, diagnosis, referralTo, onView }: PrescriptionCardProps) {
  const { t } = useTranslation()
  return (
    <View style={styles.prescriptionCard} testID="prescription-card">
      <Text style={styles.prescriptionTitle}>{t('consultation.prescription_ready')}</Text>
      {diagnosis && <Text style={styles.prescriptionDiagnosis}>{diagnosis}</Text>}
      <Text style={styles.prescriptionMeds}>
        {prescription.medications.length} {t('consultation.medications').toLowerCase()}
      </Text>
      {referralTo && (
        <Text style={styles.prescriptionReferral}>
          {t('consultation.referred_to')}: {referralTo}
        </Text>
      )}
      <TouchableOpacity style={styles.viewBtn} onPress={onView} testID="view-prescription-btn">
        <Text style={styles.viewBtnText}>{t('consultation.view_prescription')}</Text>
      </TouchableOpacity>
    </View>
  )
}

interface RatingCardProps {
  consultationId: string
  onRated: () => void
}

function RatingCard({ consultationId, onRated }: RatingCardProps) {
  const { t } = useTranslation()
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    if (stars === 0) return
    setSubmitting(true)
    try {
      await api.post('/api/ratings', { consultation_id: consultationId, stars, comment: comment.trim() || undefined })
      setDone(true)
      onRated()
    } catch {
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <View style={styles.ratingCard} testID="rating-thanks">
        <Text style={styles.ratingThanks}>{t('consultation.rate_thanks')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.ratingCard} testID="rating-card">
      <Text style={styles.ratingTitle}>{t('consultation.rate_title')}</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => setStars(n)} testID={`star-${n}`}>
            <Text style={[styles.star, n <= stars && styles.starActive]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.ratingInput}
        value={comment}
        onChangeText={setComment}
        placeholder={t('consultation.rate_comment')}
        multiline
        numberOfLines={2}
        testID="rating-comment"
      />
      <TouchableOpacity
        style={[styles.ratingBtn, (stars === 0 || submitting) && styles.ratingBtnDisabled]}
        onPress={handleSubmit}
        disabled={stars === 0 || submitting}
        testID="rating-submit"
      >
        {submitting
          ? <ActivityIndicator color={colors.text.inverse} />
          : <Text style={styles.ratingBtnText}>{t('consultation.rate_submit')}</Text>}
      </TouchableOpacity>
    </View>
  )
}

export default function ConsultationScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const insets = useSafeAreaInsets()
  const token = useAuthStore((s) => s.token)
  const userId = useAuthStore((s) => s.userId)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const { messages, status, appendMessage, setStatus } = useConsultationStore()
  const [inputText, setInputText] = useState('')
  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [diagnosis, setDiagnosis] = useState<string | null>(null)
  const [referralTo, setReferralTo] = useState<string | null>(null)
  const [rated, setRated] = useState(false)
  const listRef = useRef<FlatList>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isCompleted = status === 'completed'

  const handleConsultationUpdated = useCallback(
    async (data: { id: string; status: string }) => {
      if (data.id !== consultationId) return
      if (data.status === 'completed') {
        await setStatus('completed')
        const { data: detail } = await api.get<ConsultationDetail>(`/api/consultations/${consultationId}`)
        setPrescription(detail.prescription)
        setDiagnosis(detail.diagnosis)
        setReferralTo((detail as any).referral_to ?? null)
      }
    },
    [consultationId, setStatus],
  )

  const handleReceiveMessage = useCallback(
    (msg: Message) => {
      appendMessage(msg)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
      scrollTimer.current = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    },
    [appendMessage],
  )

  const handleVideoInvite = useCallback(
    (_data: { consultation_id: string; from_user_id: string }) => {
      Alert.alert(
        t('consultation.video_incoming'),
        '',
        [
          {
            text: t('consultation.video_decline'),
            style: 'cancel',
            onPress: () => socketService.emit('video_call_declined', { consultation_id: consultationId }),
          },
          {
            text: t('consultation.video_accept'),
            onPress: () => navigation.navigate('VideoCallScreen', { consultationId }),
          },
        ]
      )
    },
    [t, consultationId, navigation],
  )

  const handleVideoDeclined = useCallback(
    (_data: { consultation_id: string }) => {
      Alert.alert(t('consultation.video_declined'))
    },
    [t],
  )

  useEffect(() => {
    useConsultationStore.getState().clear()

    socketService.connect(baseURL, token ?? '')
    socketService.emit('join_consultation', { consultation_id: consultationId })
    socketService.on('receive_message', handleReceiveMessage)
    socketService.on('consultation_updated', handleConsultationUpdated)
    socketService.on('video_call_invite', handleVideoInvite)
    socketService.on('video_call_declined', handleVideoDeclined)

    api.get<ConsultationDetail & { messages: Message[] }>(`/api/consultations/${consultationId}`)
      .then(({ data }) => {
        data.messages?.forEach((m) => appendMessage(m))
        if (data.status === 'completed') {
          setStatus('completed')
          setPrescription(data.prescription)
          setDiagnosis(data.diagnosis)
          setReferralTo((data as any).referral_to ?? null)
          if (data.rating) setRated(true)
        }
      })
      .catch(() => {})

    return () => {
      socketService.off('receive_message', handleReceiveMessage)
      socketService.off('consultation_updated', handleConsultationUpdated)
      socketService.off('video_call_invite', handleVideoInvite)
      socketService.off('video_call_declined', handleVideoDeclined)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [consultationId, handleReceiveMessage, handleConsultationUpdated, handleVideoInvite, handleVideoDeclined, baseURL, token])

  const handleSend = () => {
    const content = inputText.trim()
    if (!content) return
    socketService.emit('send_message', {
      consultation_id: consultationId,
      content,
      msg_type: 'text',
    })
    setInputText('')
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === userId
    if (item.msg_type === 'image') {
      return (
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Image source={{ uri: item.content }} style={styles.msgImage} resizeMode="cover" />
        </View>
      )
    }
    return (
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
          {item.content}
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        ListFooterComponent={
          prescription ? (
            <View>
              <PrescriptionCard
                prescription={prescription}
                diagnosis={diagnosis}
                referralTo={referralTo}
                onView={() => navigation.navigate('PrescriptionScreen', { consultationId })}
              />
              {!rated && (
                <RatingCard consultationId={consultationId} onRated={() => setRated(true)} />
              )}
            </View>
          ) : null
        }
      />

      {!isCompleted && (
        <TouchableOpacity
          style={styles.videoBtn}
          onPress={() => {
            socketService.emit('video_call_invite', { consultation_id: consultationId })
            navigation.navigate('VideoCallScreen', { consultationId })
          }}
          testID="video-call-btn"
        >
          <Text style={styles.videoBtnText}>{t('consultation.video_call')}</Text>
        </TouchableOpacity>
      )}

      {isCompleted ? (
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={async () => {
            await useConsultationStore.getState().clear()
            navigation.popToTop()
          }}
          testID="done-btn"
        >
          <Text style={styles.doneBtnText}>{t('consultation.done')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t('consultation.chat_placeholder')}
            testID="chat-input"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            testID="send-btn"
          >
            <Text style={styles.sendBtnText}>{t('consultation.send')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.base },
  messageList: { padding: spacing[4], paddingBottom: spacing[2] },
  bubble: { maxWidth: '80%', borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[2] },
  bubbleMine: { backgroundColor: colors.surface.cardBrand, alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: colors.surface.card, alignSelf: 'flex-start' },
  bubbleTextMine: { color: colors.text.brand, fontSize: typography.size.base, fontFamily: 'DMSans' },
  bubbleTextTheirs: { color: colors.text.primary, fontSize: typography.size.base, fontFamily: 'DMSans' },
  prescriptionCard: {
    backgroundColor: colors.surface.cardBrand, borderWidth: 1, borderColor: colors.surface.borderBrand,
    borderRadius: radius.md, padding: spacing[4], marginTop: spacing[2],
  },
  prescriptionTitle: { fontSize: typography.size.md, fontFamily: 'DMSansSemibold', color: colors.text.brand, marginBottom: spacing[1] },
  prescriptionDiagnosis: { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginBottom: spacing[1] },
  prescriptionMeds: { fontSize: typography.size.md, color: colors.text.secondary, marginBottom: spacing[1], fontFamily: 'DMSans' },
  prescriptionReferral: { fontSize: typography.size.md, color: colors.status.amber, fontFamily: 'DMSansSemibold', marginBottom: spacing[3] },
  viewBtn: { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[3], alignItems: 'center' },
  viewBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  videoBtn: {
    backgroundColor: colors.teal.teal400, borderRadius: radius.full,
    marginHorizontal: spacing[3], marginBottom: spacing[2],
    padding: spacing[3], alignItems: 'center',
  },
  videoBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  inputRow: {
    flexDirection: 'row', padding: spacing[3], borderTopWidth: 1,
    borderTopColor: colors.surface.border, gap: spacing[2], alignItems: 'center',
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.md,
    padding: spacing[3], fontSize: typography.size.base, fontFamily: 'DMSans',
    backgroundColor: colors.surface.input, color: colors.text.primary,
  },
  inputDisabled: { backgroundColor: colors.surface.card, color: colors.text.muted },
  sendBtn: { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[3] },
  sendBtnDisabled: { backgroundColor: colors.brand.green400, opacity: 0.4 },
  sendBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold' },
  msgImage: { width: 200, height: 150, borderRadius: radius.sm },
  doneBtn: {
    margin: spacing[4], backgroundColor: colors.brand.green400,
    borderRadius: radius.full, padding: spacing[4], alignItems: 'center',
  },
  doneBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
  ratingCard: {
    borderWidth: 1, borderColor: colors.surface.border, borderRadius: radius.md,
    padding: spacing[4], marginTop: spacing[3], backgroundColor: colors.surface.card,
  },
  ratingTitle: { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginBottom: spacing[3] },
  starsRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  star: { fontSize: 32, color: colors.surface.border },
  starActive: { color: colors.status.amber },
  ratingInput: {
    borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.sm,
    padding: spacing[3], fontSize: typography.size.md, fontFamily: 'DMSans',
    minHeight: 60, textAlignVertical: 'top', marginBottom: spacing[3],
    backgroundColor: colors.surface.input, color: colors.text.primary,
  },
  ratingBtn: {
    backgroundColor: colors.brand.green400, borderRadius: radius.full,
    padding: spacing[3], alignItems: 'center',
  },
  ratingBtnDisabled: { opacity: 0.4 },
  ratingBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  ratingThanks: { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.brand, textAlign: 'center', paddingVertical: spacing[2] },
})
