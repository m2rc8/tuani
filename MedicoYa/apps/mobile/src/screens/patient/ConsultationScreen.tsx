import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import { useConsultationStore } from '../../store/consultationStore'
import type { ConsultationDetail, Message, Prescription } from '../../lib/types'

interface PrescriptionCardProps {
  prescription: Prescription
  diagnosis: string | null
  onView: () => void
}

function PrescriptionCard({ prescription, diagnosis, onView }: PrescriptionCardProps) {
  const { t } = useTranslation()
  return (
    <View style={styles.prescriptionCard} testID="prescription-card">
      <Text style={styles.prescriptionTitle}>{t('consultation.prescription_ready')}</Text>
      {diagnosis && <Text style={styles.prescriptionDiagnosis}>{diagnosis}</Text>}
      <Text style={styles.prescriptionMeds}>
        {prescription.medications.length} {t('consultation.medications').toLowerCase()}
      </Text>
      <TouchableOpacity style={styles.viewBtn} onPress={onView} testID="view-prescription-btn">
        <Text style={styles.viewBtnText}>{t('consultation.view_prescription')}</Text>
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

  useEffect(() => {
    useConsultationStore.getState().clear()

    socketService.connect(baseURL, token ?? '')
    socketService.emit('join_consultation', { consultation_id: consultationId })
    socketService.on('receive_message', handleReceiveMessage)
    socketService.on('consultation_updated', handleConsultationUpdated)

    api.get<ConsultationDetail & { messages: Message[] }>(`/api/consultations/${consultationId}`)
      .then(({ data }) => {
        data.messages?.forEach((m) => appendMessage(m))
        if (data.status === 'completed') {
          setStatus('completed')
          setPrescription(data.prescription)
          setDiagnosis(data.diagnosis)
        }
      })
      .catch(() => {})

    return () => {
      socketService.off('receive_message', handleReceiveMessage)
      socketService.off('consultation_updated', handleConsultationUpdated)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [consultationId, handleReceiveMessage, handleConsultationUpdated, baseURL, token])

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
          prescription
            ? <PrescriptionCard
                prescription={prescription}
                diagnosis={diagnosis}
                onView={() => navigation.navigate('PrescriptionScreen', { consultationId })}
              />
            : null
        }
      />

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
  container: { flex: 1, backgroundColor: '#fff' },
  messageList: { padding: 16, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 12, padding: 10, marginBottom: 8 },
  bubbleMine: { backgroundColor: '#EFF6FF', alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: '#F1F5F9', alignSelf: 'flex-start' },
  bubbleTextMine: { color: '#1D4ED8', fontSize: 15 },
  bubbleTextTheirs: { color: '#334155', fontSize: 15 },
  prescriptionCard: {
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC',
    borderRadius: 12, padding: 16, marginTop: 8,
  },
  prescriptionTitle: { fontSize: 14, fontWeight: '700', color: '#166534', marginBottom: 4 },
  prescriptionDiagnosis: { fontSize: 15, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  prescriptionMeds: { fontSize: 13, color: '#64748B', marginBottom: 12 },
  viewBtn: { backgroundColor: '#22C55E', borderRadius: 8, padding: 10, alignItems: 'center' },
  viewBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  inputRow: {
    flexDirection: 'row', padding: 12, borderTopWidth: 1,
    borderTopColor: '#E2E8F0', gap: 8, alignItems: 'center',
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    padding: 10, fontSize: 15,
  },
  inputDisabled: { backgroundColor: '#F1F5F9', color: '#94A3B8' },
  sendBtn: { backgroundColor: '#3B82F6', borderRadius: 10, padding: 10 },
  sendBtnDisabled: { backgroundColor: '#93C5FD' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  msgImage: { width: 200, height: 150, borderRadius: 8 },
})
