import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Notifications from 'expo-notifications'
import './i18n'
import i18n from './i18n'
import { useAuthStore } from './store/authStore'
import { useBrigadeStore } from './store/brigadeStore'
import RootNavigator from './navigation/RootNavigator'
import { registerForPushNotifications } from './lib/notifications'
import { registerRootComponent } from 'expo'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
})

function App() {
  const [ready, setReady] = useState(false)
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
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

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

registerRootComponent(App)
export default App
