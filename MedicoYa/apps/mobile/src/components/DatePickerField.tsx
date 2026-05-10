'use client'
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { tokens } from '../theme/tokens'

const { colors, spacing, radius, typography } = tokens

interface Props {
  label:       string
  value:       string        // YYYY-MM-DD
  onChange:    (v: string) => void
  maxDate?:    Date
  minDate?:    Date
  placeholder?: string
}

export default function DatePickerField({ label, value, onChange, maxDate, minDate, placeholder }: Props) {
  const [show, setShow] = useState(false)

  const parsed = value ? new Date(value + 'T00:00:00') : new Date()

  const handleChange = (_e: DateTimePickerEvent, selected?: Date) => {
    setShow(Platform.OS === 'ios')
    if (selected) {
      const iso = selected.toISOString().split('T')[0]
      onChange(iso)
    }
  }

  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('es-HN', { year: 'numeric', month: 'long', day: 'numeric' })
    : placeholder ?? 'Seleccionar fecha'

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={() => setShow(true)}>
        <Text style={[styles.text, !value && styles.placeholder]}>{display}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={parsed}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          maximumDate={maxDate}
          minimumDate={minDate}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { marginBottom: spacing[1] },
  label:       { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: 'DMSans', marginBottom: spacing[1], marginTop: spacing[3] },
  field:       {
    borderWidth: 1, borderColor: colors.surface.inputBorder, borderRadius: radius.md,
    padding: spacing[3], backgroundColor: colors.surface.input,
  },
  text:        { fontSize: typography.size.base, color: colors.text.primary, fontFamily: 'DMSans' },
  placeholder: { color: colors.text.muted },
})
