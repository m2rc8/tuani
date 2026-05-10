import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

export default function DentalPickerScreen({ navigation }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [phone,   setPhone]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    const p = phone.trim()
    if (!p) return
    setLoading(true)
    try {
      const { data } = await api.get<{ id: string }>(`/api/patients/by-phone/${encodeURIComponent(p)}`)
      navigation.navigate('DentalRecordScreen', { patientId: data.id })
    } catch {
      Alert.alert(t('dental.patient_not_found'), t('dental.check_phone'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing[6] }]}>
      <Text style={styles.title}>Odontología</Text>
      <Text style={styles.subtitle}>{t('dental.subtitle')}</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+504XXXXXXXX"
        placeholderTextColor={colors.text.muted}
        keyboardType="phone-pad"
        autoFocus
      />
      <TouchableOpacity
        style={[styles.btn, (!phone.trim() || loading) && styles.btnDisabled]}
        onPress={handleStart}
        disabled={!phone.trim() || loading}
      >
        {loading
          ? <ActivityIndicator color={colors.text.inverse} />
          : <Text style={styles.btnText}>{t('dental.start_record')}</Text>}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.base, padding: spacing[6] },
  title:     { fontSize: typography.size.xl, fontFamily: 'DMSerifDisplay', color: colors.text.primary, marginBottom: spacing[2] },
  subtitle:  { color: colors.text.secondary, fontFamily: 'DMSans', fontSize: typography.size.md, marginBottom: spacing[6] },
  input:     { borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.md, padding: spacing[3], color: colors.text.primary, fontFamily: 'DMSans', fontSize: typography.size.base, backgroundColor: colors.surface.input, marginBottom: spacing[4] },
  btn:       { backgroundColor: colors.brand.green400, borderRadius: radius.full, padding: spacing[4], alignItems: 'center' },
  btnDisabled: { opacity: 0.4 },
  btnText:   { color: colors.text.inverse, fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
})
