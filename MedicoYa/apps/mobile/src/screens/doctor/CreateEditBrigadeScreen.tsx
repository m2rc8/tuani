import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

interface InitialData {
  name?: string
  community?: string
  municipality?: string
  department?: string
  start_date?: string
  end_date?: string
  brigade_type?: string
}

interface Props {
  navigation: any
  route: {
    params?: {
      brigadeId?: string
      initialData?: InitialData
    }
  }
}

export default function CreateEditBrigadeScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const params = route.params ?? {}
  const { brigadeId, initialData } = params

  const [name, setName] = useState(initialData?.name ?? '')
  const [community, setCommunity] = useState(initialData?.community ?? '')
  const [municipality, setMunicipality] = useState(initialData?.municipality ?? '')
  const [department, setDepartment] = useState(initialData?.department ?? '')
  const [startDate, setStartDate] = useState(initialData?.start_date ?? '')
  const [endDate, setEndDate] = useState(initialData?.end_date ?? '')
  const [brigadeType, setBrigadeType] = useState<'medical' | 'dental'>(
    (initialData?.brigade_type as 'medical' | 'dental') ?? 'medical'
  )
  const [saving, setSaving] = useState(false)

  const isEdit = !!brigadeId

  const handleSubmit = async () => {
    if (!name.trim() || !community.trim()) {
      Alert.alert(t('brigade.error_name_required'))
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        community: community.trim(),
        municipality: municipality.trim() || undefined,
        department: department.trim() || undefined,
        start_date: startDate.trim() || undefined,
        end_date: endDate.trim() || undefined,
        brigade_type: brigadeType,
      }

      if (isEdit) {
        await api.put(`/api/brigades/${brigadeId}`, payload)
      } else {
        await api.post('/api/brigades', payload)
      }

      navigation.goBack()
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.fieldLabel}>{t('brigade.field_name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('brigade.field_name')}
        placeholderTextColor={colors.text.secondary}
        testID="field-name"
      />

      <Text style={styles.fieldLabel}>{t('brigade.field_community')}</Text>
      <TextInput
        style={styles.input}
        value={community}
        onChangeText={setCommunity}
        placeholder={t('brigade.field_community')}
        placeholderTextColor={colors.text.secondary}
        testID="field-community"
      />

      <Text style={styles.fieldLabel}>{t('brigade.field_municipality')}</Text>
      <TextInput
        style={styles.input}
        value={municipality}
        onChangeText={setMunicipality}
        placeholder={t('brigade.field_municipality')}
        placeholderTextColor={colors.text.secondary}
        testID="field-municipality"
      />

      <Text style={styles.fieldLabel}>{t('brigade.field_department')}</Text>
      <TextInput
        style={styles.input}
        value={department}
        onChangeText={setDepartment}
        placeholder={t('brigade.field_department')}
        placeholderTextColor={colors.text.secondary}
        testID="field-department"
      />

      <Text style={styles.fieldLabel}>{t('brigade.field_start_date')}</Text>
      <TextInput
        style={styles.input}
        value={startDate}
        onChangeText={setStartDate}
        placeholder="YYYY-MM-DDTHH:mm:ssZ"
        placeholderTextColor={colors.text.secondary}
        autoCapitalize="none"
        testID="field-start-date"
      />

      <Text style={styles.fieldLabel}>{t('brigade.field_end_date')}</Text>
      <TextInput
        style={styles.input}
        value={endDate}
        onChangeText={setEndDate}
        placeholder="YYYY-MM-DDTHH:mm:ssZ"
        placeholderTextColor={colors.text.secondary}
        autoCapitalize="none"
        testID="field-end-date"
      />

      <Text style={styles.fieldLabel}>{t('brigade.field_type')}</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, brigadeType === 'medical' && styles.toggleBtnActive]}
          onPress={() => setBrigadeType('medical')}
          testID="type-medical"
        >
          <Text style={[styles.toggleBtnText, brigadeType === 'medical' && styles.toggleBtnTextActive]}>
            {t('brigade.type_medical')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, brigadeType === 'dental' && styles.toggleBtnActive]}
          onPress={() => setBrigadeType('dental')}
          testID="type-dental"
        >
          <Text style={[styles.toggleBtnText, brigadeType === 'dental' && styles.toggleBtnTextActive]}>
            {t('brigade.type_dental')}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={saving}
        testID="submit-btn"
      >
        {saving ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : (
          <Text style={styles.submitBtnText}>
            {saving ? t('brigade.saving') : t('brigade.save')}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.base,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  fieldLabel: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    fontFamily: 'DMSansSemibold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[1],
    marginTop: spacing[3],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.surface.inputBorder,
    borderRadius: radius.sm,
    padding: spacing[3],
    fontSize: typography.size.base,
    backgroundColor: colors.surface.input,
    fontFamily: 'DMSans',
    color: colors.text.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.sm,
    paddingVertical: spacing[3],
    alignItems: 'center',
    backgroundColor: colors.surface.card,
  },
  toggleBtnActive: {
    borderColor: colors.brand.green400,
    backgroundColor: colors.brand.green400,
  },
  toggleBtnText: {
    fontFamily: 'DMSansSemibold',
    fontSize: typography.size.base,
    color: colors.text.secondary,
  },
  toggleBtnTextActive: {
    color: colors.text.inverse,
  },
  submitBtn: {
    backgroundColor: colors.brand.green400,
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[6],
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.text.inverse,
    fontFamily: 'DMSansSemibold',
    fontSize: typography.size.md,
  },
})
