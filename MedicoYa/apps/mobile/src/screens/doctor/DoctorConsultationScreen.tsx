import React, { useEffect, useCallback, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import { useConsultationStore } from '../../store/consultationStore'
import type { ConsultationDetail, Message } from '../../lib/types'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

export default function DoctorConsultationScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const insets = useSafeAreaInsets()
  const token = useAuthStore((s: any) => s.token)
  const userId = useAuthStore((s: any) => s.userId)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const { messages, status, appendMessage, setStatus } = useConsultationStore()
  const [inputText, setInputText] = useState('')
  const listRef = useRef<FlatList>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [priceLps, setPriceLps] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'confirmed' | null>(null)
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [symptomPhoto, setSymptomPhoto] = useState<string | null>(null)
  const [symptomsText, setSymptomsText] = useState<string | null>(null)

  const isCompleted = status === 'completed'

  const handleReceiveMessage = useCallback((msg: Message) => {
    appendMessage(msg)
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [appendMessage])

  const handleConsultationUpdated = useCallback(async (data: { id: string; status: string }) => {
    if (data.id !== consultationId) return
    if (data.status === 'completed') await setStatus('completed')
  }, [consultationId, setStatus])

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
        if (data.status === 'completed') setStatus('completed')
        setPriceLps(data.price_lps ?? null)
        setPaymentStatus(data.payment_status ?? null)
        setSymptomPhoto(data.symptom_photo ?? null)
        setSymptomsText(data.symptoms_text ?? null)
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

  const handleConfirmPayment = async () => {
    setConfirmingPayment(true)
    try {
      await api.put(`/api/consultations/${consultationId}/payment`)
      setPaymentStatus('confirmed')
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setConfirmingPayment(false)
    }
  }

  const handleSend = () => {
    const content = inputText.trim()
    if (!content) return
    socketService.emit('send_message', { consultation_id: consultationId, content, msg_type: 'text' })
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

  const ListHeader = (symptomsText || symptomPhoto) ? (
    <View style={styles.symptomsHeader}>
      {symptomsText ? (
        <Text style={styles.symptomsText}>{symptomsText}</Text>
      ) : null}
      {symptomPhoto ? (
        <Image source={{ uri: symptomPhoto }} style={styles.symptomPhoto} resizeMode="cover" />
      ) : null}
    </View>
  ) : null

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {!isCompleted && (
        <TouchableOpacity
          style={styles.completeBar}
          onPress={() => navigation.navigate('WriteRxScreen', { consultationId })}
          testID="complete-btn"
        >
          <Text style={styles.completeBarText}>{t('doctor.complete_cta')}</Text>
        </TouchableOpacity>
      )}

      {isCompleted && paymentStatus === 'pending' && (
        <TouchableOpacity
          style={styles.paymentBar}
          onPress={handleConfirmPayment}
          disabled={confirmingPayment}
          testID="confirm-payment-btn"
        >
          {confirmingPayment
            ? <ActivityIndicator color={colors.text.inverse} />
            : <Text style={styles.paymentBarText}>
                {priceLps
                  ? t('doctor.confirm_payment_amount', { amount: parseFloat(priceLps).toFixed(2) })
                  : t('doctor.confirm_payment')}
              </Text>
          }
        </TouchableOpacity>
      )}

      {isCompleted && paymentStatus === 'confirmed' && (
        <View style={styles.paymentConfirmed} testID="payment-confirmed">
          <Text style={styles.paymentConfirmedText}>{t('doctor.payment_confirmed')}</Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.messageList}
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

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, isCompleted && styles.inputDisabled]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('consultation.chat_placeholder')}
          editable={!isCompleted}
          testID="chat-input"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || isCompleted) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isCompleted}
          testID="send-btn"
        >
          <Text style={styles.sendBtnText}>{t('consultation.send')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.base },
  completeBar: {
    backgroundColor: colors.brand.green400, padding: spacing[3], alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.surface.borderBrand,
  },
  completeBarText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
  paymentBar: {
    backgroundColor: colors.status.amber, padding: spacing[3], alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.status.amber,
  },
  paymentBarText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  paymentConfirmed: {
    backgroundColor: colors.surface.cardBrand, padding: spacing[3], alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.surface.borderBrand,
  },
  paymentConfirmedText: { color: colors.text.brand, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  symptomsHeader: {
    backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[3],
    marginBottom: spacing[3], borderWidth: 1, borderColor: colors.surface.borderBrand,
  },
  symptomsText: { fontSize: typography.size.md, color: colors.text.secondary, marginBottom: spacing[2], lineHeight: 20, fontFamily: 'DMSans' },
  symptomPhoto: { width: '100%', height: 200, borderRadius: radius.sm },
  messageList: { padding: spacing[4], paddingBottom: spacing[2] },
  bubble: { maxWidth: '80%', borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[2] },
  bubbleMine: { backgroundColor: colors.surface.cardBrand, alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: colors.surface.card, alignSelf: 'flex-start' },
  bubbleTextMine: { color: colors.text.brand, fontSize: typography.size.base, fontFamily: 'DMSans' },
  bubbleTextTheirs: { color: colors.text.primary, fontSize: typography.size.base, fontFamily: 'DMSans' },
  msgImage: { width: 200, height: 150, borderRadius: radius.sm },
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
  input: { flex: 1, borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.md, padding: spacing[3], fontSize: typography.size.base, fontFamily: 'DMSans', backgroundColor: colors.surface.input, color: colors.text.primary },
  inputDisabled: { backgroundColor: colors.surface.card, color: colors.text.muted },
  sendBtn: { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[3] },
  sendBtnDisabled: { backgroundColor: colors.brand.green400, opacity: 0.4 },
  sendBtnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold' },
})
