import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

export default function DoctorRegisterScreen({ navigation }: any) {
  const { t } = useTranslation()
  const login = useAuthStore((s) => s.login)

  const [step,      setStep]      = useState<1 | 2 | 3>(1)
  const [phone,     setPhone]     = useState('')
  const [code,      setCode]      = useState('')
  const [name,      setName]      = useState('')
  const [cedula,    setCedula]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const handleSendCode = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/send-otp', { phone })
      setStep(2)
    } catch {
      setError(t('auth.error_send'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = () => {
    if (code.length < 6) return
    setStep(3)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<{
        token: string
        user: { id: string; role: string; preferred_language: string }
      }>('/api/auth/register-doctor', { phone, code, name, cedula })
      await login(data.token, data.user)
    } catch (err: any) {
      const msg = err?.response?.data?.error
      if (msg === 'Invalid or expired code') {
        setError(t('auth.error_verify'))
        setStep(2)
      } else {
        setError(t('common.error_generic'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('auth.doctor_register_title')}</Text>

        {step === 1 && (
          <>
            <Text style={styles.label}>{t('auth.phone_label')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+50499000000"
              keyboardType="phone-pad"
              autoComplete="tel"
              testID="dr-phone-input"
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity
              style={[styles.btn, (!phone.trim() || loading) && styles.btnDisabled]}
              onPress={handleSendCode}
              disabled={!phone.trim() || loading}
              testID="dr-send-btn"
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{t('auth.send_code')}</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.label}>{t('auth.code_label')}</Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              testID="dr-code-input"
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity
              style={[styles.btn, code.length < 6 && styles.btnDisabled]}
              onPress={handleVerifyCode}
              disabled={code.length < 6}
              testID="dr-verify-btn"
            >
              <Text style={styles.btnText}>{t('auth.verify')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep(1)}>
              <Text style={styles.link}>{t('auth.change_phone')}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.label}>{t('auth.doctor_name_label')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Dr. Juan Pérez"
              autoCapitalize="words"
              testID="dr-name-input"
            />
            <Text style={styles.label}>{t('auth.doctor_cedula_label')}</Text>
            <TextInput
              style={styles.input}
              value={cedula}
              onChangeText={setCedula}
              placeholder="0000-0000-00000"
              testID="dr-cedula-input"
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity
              style={[styles.btn, (!name.trim() || !cedula.trim() || loading) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={!name.trim() || !cedula.trim() || loading}
              testID="dr-submit-btn"
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{t('auth.doctor_submit')}</Text>}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Text style={styles.link}>{t('auth.back_to_login')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:  { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title:      { fontSize: 22, fontWeight: '700', marginBottom: 24, color: '#1E293B' },
  label:      { fontSize: 15, marginBottom: 4, color: '#334155' },
  input:      {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 16,
  },
  codeInput:  {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
    padding: 12, fontSize: 28, textAlign: 'center', letterSpacing: 8, marginBottom: 16,
  },
  btn:        { backgroundColor: '#3B82F6', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { color: '#fff', fontWeight: '600', fontSize: 16 },
  error:      { color: '#EF4444', marginBottom: 8 },
  link:       { color: '#3B82F6', textAlign: 'center', marginTop: 16, fontSize: 14 },
  backRow:    { marginTop: 8 },
})
