import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConsultationStore } from '../../store/consultationStore'
import type { AvailableDoctor } from '../../lib/types'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

const MAX_CHARS = 500

interface PickedPhoto { uri: string }

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { activeConsultationId, status, setActive } = useConsultationStore()
  const [symptoms,    setSymptoms]    = useState('')
  const [photo,       setPhoto]       = useState<PickedPhoto | null>(null)
  const [doctorCount, setDoctorCount] = useState<number | null>(null)
  const [submitting,  setSubmitting]  = useState(false)

  const fetchDoctors = useCallback(async () => {
    try {
      const { data } = await api.get<AvailableDoctor[]>('/api/doctors/available')
      setDoctorCount(data.length)
    } catch {
      setDoctorCount(0)
    }
  }, [])

  useEffect(() => {
    if (activeConsultationId && status === 'pending') {
      navigation.navigate('WaitingScreen', { consultationId: activeConsultationId })
      return
    }
    if (activeConsultationId && status === 'active') {
      navigation.navigate('ConsultationScreen', { consultationId: activeConsultationId })
      return
    }
    fetchDoctors()
    const interval = setInterval(fetchDoctors, 30_000)
    return () => clearInterval(interval)
  }, [activeConsultationId, status, fetchDoctors])

  const pickPhoto = async (source: 'camera' | 'library') => {
    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: 'Images' })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'Images' })
      if (!result.canceled) {
        const compressed = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 1080 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        )
        setPhoto({ uri: compressed.uri })
      }
    } catch {
      Alert.alert(t('common.error_generic'))
    }
  }

  const showPhotoPicker = () => {
    Alert.alert(t('consultation.add_photo'), '', [
      { text: t('consultation.photo_camera'),  onPress: () => pickPhoto('camera')  },
      { text: t('consultation.photo_library'), onPress: () => pickPhoto('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  const canSubmit = symptoms.trim().length > 0 && (doctorCount ?? 0) > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('symptoms_text', symptoms.trim())
      if (photo) {
        formData.append('photo', {
          uri:  photo.uri,
          type: 'image/jpeg',
          name: 'symptom.jpg',
        } as any)
      }
      const { data } = await api.post<{ id: string }>('/api/consultations', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await setActive(data.id, 'pending')
      navigation.navigate('WaitingScreen', { consultationId: data.id })
    } catch {
      Alert.alert(t('common.error_generic'))
      setSubmitting(false)
    }
  }

  const doctorBadge = doctorCount === null
    ? null
    : doctorCount === 0
      ? t('consultation.no_doctors')
      : t('consultation.doctors_available', { count: doctorCount })

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing[6] }]}>
      <Text style={styles.title}>{t('nav.home')}</Text>

      {doctorBadge && (
        <View style={[styles.badge, doctorCount === 0 && styles.badgeWarn]} testID="doctor-badge">
          <Text style={[styles.badgeText, doctorCount === 0 && styles.badgeTextWarn]}>
            {doctorBadge}
          </Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder={t('consultation.symptoms_placeholder')}
        value={symptoms}
        onChangeText={(v) => setSymptoms(v.slice(0, MAX_CHARS))}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        testID="symptoms-input"
      />
      <Text style={styles.counter}>
        {t('consultation.chars_remaining', { count: MAX_CHARS - symptoms.length })}
      </Text>

      {photo
        ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photo.uri }} style={styles.thumbnail} testID="photo-thumbnail" />
            <TouchableOpacity onPress={() => setPhoto(null)} testID="remove-photo-btn">
              <Text style={styles.removePhoto}>{t('consultation.remove_photo')}</Text>
            </TouchableOpacity>
          </View>
        )
        : (
          <TouchableOpacity onPress={showPhotoPicker} style={styles.photoBtn} testID="attach-photo-btn">
            <Text style={styles.photoBtnText}>{t('consultation.add_photo')}</Text>
          </TouchableOpacity>
        )
      }

      <TouchableOpacity
        style={[styles.btn, !canSubmit && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        testID="submit-btn"
        accessibilityState={{ disabled: !canSubmit }}
      >
        {submitting
          ? <ActivityIndicator color={colors.text.inverse} />
          : <Text style={styles.btnText}>{t('consultation.start_cta')}</Text>}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, padding: spacing[6], backgroundColor: colors.surface.base },
  title:         { fontSize: typography.size.xl, fontFamily: 'DMSerifDisplay', marginBottom: spacing[4], color: colors.text.primary },
  badge:         {
    backgroundColor: colors.surface.cardBrand, borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[4], alignItems: 'center',
  },
  badgeWarn:     { backgroundColor: colors.status.amber + '20' },
  badgeText:     { fontSize: typography.size.md, color: colors.text.brand, fontFamily: 'DMSansSemibold' },
  badgeTextWarn: { color: colors.status.amber },
  input:         {
    borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.md,
    padding: spacing[3], fontSize: typography.size.base, minHeight: 140, marginBottom: spacing[2],
    fontFamily: 'DMSans', backgroundColor: colors.surface.input, color: colors.text.primary,
  },
  counter:       { fontSize: typography.size.sm, color: colors.text.secondary, marginBottom: spacing[3], textAlign: 'right', fontFamily: 'DMSans' },
  photoBtn:      {
    borderWidth: 1, borderColor: colors.surface.border, borderRadius: radius.sm,
    padding: spacing[3], alignItems: 'center', marginBottom: spacing[3],
  },
  photoBtnText:  { color: colors.text.secondary, fontSize: typography.size.md, fontFamily: 'DMSans' },
  photoRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3], gap: spacing[3] },
  thumbnail:     { width: 60, height: 60, borderRadius: radius.sm },
  removePhoto:   { color: colors.status.red, fontSize: typography.size.md, fontFamily: 'DMSans' },
  btn:           {
    backgroundColor: colors.brand.green400, borderRadius: radius.full,
    padding: spacing[4], alignItems: 'center',
  },
  btnDisabled:   { backgroundColor: colors.brand.green400, opacity: 0.4 },
  btnText:       { color: colors.text.inverse, fontSize: typography.size.base, fontFamily: 'DMSansSemibold' },
})
