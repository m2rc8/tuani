import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import './i18n'
import i18n from './i18n'
import { useAuthStore } from './store/authStore'
import { useBrigadeStore } from './store/brigadeStore'
import RootNavigator from './navigation/RootNavigator'
import { registerForPushNotifications } from './lib/notifications'

export default function App() {
  const [ready, setReady] = useState(false)
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      })
    } catch {}

    async function init() {
      try {
        await hydrate()
        await i18n.changeLanguage(useAuthStore.getState().language)
        if (useAuthStore.getState().role) {
          registerForPushNotifications().catch(() => {})
        }
        await useBrigadeStore.getState().hydrate()
      } finally {
        setReady(true)
      }
    }
    init()
  }, [hydrate])

  if (!ready) return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  )

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
})
