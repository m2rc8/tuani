import React, { useEffect, useCallback, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import { useConsultationStore } from '../../store/consultationStore'
import type { ConsultationDetail, Message } from '../../lib/types'

export default function DoctorConsultationScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const token = useAuthStore((s: any) => s.token)
  const userId = useAuthStore((s: any) => s.userId)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const { messages, status, appendMessage, setStatus } = useConsultationStore()
  const [inputText, setInputText] = useState('')
  const listRef = useRef<FlatList>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    socketService.connect(baseURL, token ?? '')
    socketService.emit('join_consultation', { consultation_id: consultationId })
    socketService.on('receive_message', handleReceiveMessage)
    socketService.on('consultation_updated', handleConsultationUpdated)

    api.get<ConsultationDetail & { messages: Message[] }>(`/api/consultations/${consultationId}`)
      .then(({ data }) => {
        data.messages?.forEach((m) => appendMessage(m))
        if (data.status === 'completed') setStatus('completed')
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
    socketService.emit('send_message', { consultation_id: consultationId, content, msg_type: 'text' })
    setInputText('')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
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

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => {
          const isMine = item.sender_id === userId
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
                {item.content}
              </Text>
            </View>
          )
        }}
        contentContainerStyle={styles.messageList}
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
  completeBar: {
    backgroundColor: '#22C55E', padding: 12, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#BBF7D0',
  },
  completeBarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  messageList: { padding: 16, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 12, padding: 10, marginBottom: 8 },
  bubbleMine: { backgroundColor: '#EFF6FF', alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: '#F1F5F9', alignSelf: 'flex-start' },
  bubbleTextMine: { color: '#1D4ED8', fontSize: 15 },
  bubbleTextTheirs: { color: '#334155', fontSize: 15 },
  inputRow: {
    flexDirection: 'row', padding: 12, borderTopWidth: 1,
    borderTopColor: '#E2E8F0', gap: 8, alignItems: 'center',
  },
  input: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, fontSize: 15 },
  inputDisabled: { backgroundColor: '#F1F5F9', color: '#94A3B8' },
  sendBtn: { backgroundColor: '#3B82F6', borderRadius: 10, padding: 10 },
  sendBtnDisabled: { backgroundColor: '#93C5FD' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
})
