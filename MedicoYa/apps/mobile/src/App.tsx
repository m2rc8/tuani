import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans'
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display'
import './i18n'
import i18n from './i18n'
import { useAuthStore } from './store/authStore'
import { useBrigadeStore } from './store/brigadeStore'
import RootNavigator from './navigation/RootNavigator'
import { registerForPushNotifications } from './lib/notifications'
import { tokens } from './theme/tokens'

const { colors } = tokens

export default function App() {
  const [ready, setReady] = useState(false)
  const hydrate = useAuthStore((s) => s.hydrate)

  const [fontsLoaded] = useFonts({
    DMSans: DMSans_400Regular,
    DMSansMedium: DMSans_500Medium,
    DMSansSemibold: DMSans_600SemiBold,
    DMSerifDisplay: DMSerifDisplay_400Regular,
  })

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

  if (!ready || !fontsLoaded) return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.brand.green400} />
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
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ui.white },
})
