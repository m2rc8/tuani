import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import api from '../../lib/api'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

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
          ? <ActivityIndicator color={colors.ui.white} />
          : <Text style={styles.btnText}>{t('auth.send_code')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('DoctorRegister')}
        style={styles.registerLink}
        testID="doctor-register-btn"
      >
        <Text style={styles.registerLinkText}>{t('auth.register_as_doctor')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing[6], justifyContent: 'center' },
  label: { fontSize: typography.size.base, marginBottom: spacing[1], fontFamily: 'DMSans' },
  input: {
    borderWidth: 1, borderColor: colors.ui.slate200, borderRadius: radius.sm,
    padding: spacing[3], fontSize: typography.size.base, marginBottom: spacing[2],
    fontFamily: 'DMSans',
  },
  btn: {
    backgroundColor: colors.brand.green400, padding: spacing[4],
    borderRadius: radius.sm, alignItems: 'center', marginTop: spacing[2],
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.ui.white, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
  error: { color: colors.status.red, marginBottom: spacing[1], fontFamily: 'DMSans' },
  registerLink: { marginTop: spacing[6], alignItems: 'center' },
  registerLinkText: { color: colors.brand.green400, fontSize: typography.size.md, fontFamily: 'DMSans' },
})
