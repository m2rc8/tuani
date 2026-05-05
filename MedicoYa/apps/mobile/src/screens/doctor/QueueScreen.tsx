import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'

export default function QueueScreen() {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <Text>{t('common.coming_soon')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
