import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import api from './api'

export async function registerForPushNotifications(): Promise<void> {
  if (!Constants.isDevice) return

  const { status: existing } = await Notifications.getPermissionsAsync()
  const { status } = existing === 'granted'
    ? { status: existing }
    : await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:       'default',
      importance: Notifications.AndroidImportance.MAX,
    })
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  await api.post('/api/notifications/token', { token }).catch(() => {})
}
