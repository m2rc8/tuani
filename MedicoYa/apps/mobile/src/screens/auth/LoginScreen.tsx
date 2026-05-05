import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import api from '../../lib/api'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/send-otp', { phone })
      navigation.navigate('Otp', { phone })
    } catch {
      setError(t('auth.error_send'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('auth.phone_label')}</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="+50499000000"
        keyboardType="phone-pad"
        autoComplete="tel"
        style={styles.input}
        testID="phone-input"
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        onPress={handleSend}
        disabled={!phone.trim() || loading}
        style={[styles.btn, (!phone.trim() || loading) && styles.btnDisabled]}
        testID="send-btn"
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{t('auth.send_code')}</Text>}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  label: { fontSize: 16, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 8,
  },
  btn: {
    backgroundColor: '#3B82F6', padding: 14,
    borderRadius: 8, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#EF4444', marginBottom: 4 },
})
