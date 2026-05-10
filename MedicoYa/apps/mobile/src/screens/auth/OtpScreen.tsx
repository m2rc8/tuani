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
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

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
          ? <ActivityIndicator color={colors.text.inverse} />
          : <Text style={styles.btnText}>{t('auth.verify')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()} testID="back-btn">
        <Text style={styles.back}>{t('auth.change_phone')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing[6], justifyContent: 'center', backgroundColor: colors.surface.base },
  label: { fontSize: typography.size.base, marginBottom: spacing[1], fontFamily: 'DMSans', color: colors.text.primary },
  input: {
    borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.sm,
    padding: spacing[3], fontSize: 28, textAlign: 'center', letterSpacing: 8,
    marginBottom: spacing[2], fontFamily: 'DMSans',
    backgroundColor: colors.surface.input, color: colors.text.primary,
  },
  btn: {
    backgroundColor: colors.brand.green400, padding: spacing[4],
    borderRadius: radius.full, alignItems: 'center', marginTop: spacing[2],
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
  error: { color: colors.status.red, marginBottom: spacing[1], fontFamily: 'DMSans' },
  back: { color: colors.brand.green400, textAlign: 'center', marginTop: spacing[4], fontSize: typography.size.md, fontFamily: 'DMSans' },
})
