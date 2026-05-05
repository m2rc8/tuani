import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>

export default function OtpScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const { phone } = route.params
  const login = useAuthStore((s) => s.login)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCodeChange = (text: string) => {
    setCode(text.replace(/\D/g, '').slice(0, 6))
  }

  const handleVerify = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<{
        token: string
        user: { id: string; role: string; preferred_language: string }
      }>('/api/auth/verify-otp', { phone, code })
      await login(data.token, data.user)
    } catch {
      setError(t('auth.error_verify'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('auth.code_label')}</Text>
      <TextInput
        value={code}
        onChangeText={handleCodeChange}
        keyboardType="number-pad"
        style={styles.input}
        testID="code-input"
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        onPress={handleVerify}
        disabled={code.length < 6 || loading}
        style={[styles.btn, (code.length < 6 || loading) && styles.btnDisabled]}
        testID="verify-btn"
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{t('auth.verify')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()} testID="back-btn">
        <Text style={styles.back}>{t('auth.change_phone')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  label: { fontSize: 16, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
    padding: 12, fontSize: 28, textAlign: 'center', letterSpacing: 8,
    marginBottom: 8,
  },
  btn: {
    backgroundColor: '#3B82F6', padding: 14,
    borderRadius: 8, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#EF4444', marginBottom: 4 },
  back: { color: '#3B82F6', textAlign: 'center', marginTop: 16, fontSize: 14 },
})
