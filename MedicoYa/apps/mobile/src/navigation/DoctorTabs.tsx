import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTranslation } from 'react-i18next'
import QueueScreen from '../screens/doctor/QueueScreen'
import DoctorHistoryScreen from '../screens/doctor/HistoryScreen'
import DoctorProfileScreen from '../screens/doctor/DoctorProfileScreen'
import { tokens } from '../theme/tokens'

const { colors, typography } = tokens

type DoctorTabsParamList = {
  Queue: undefined
  History: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<DoctorTabsParamList>()

export default function DoctorTabs() {
  const { t } = useTranslation()
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.green400,
        tabBarInactiveTintColor: colors.ui.slate600,
        tabBarStyle: { borderTopColor: colors.ui.slate200 },
      }}
    >
      <Tab.Screen name="Queue" component={QueueScreen} options={{ title: t('nav.queue') }} />
      <Tab.Screen name="History" component={DoctorHistoryScreen} options={{ title: t('nav.history') }} />
      <Tab.Screen name="Profile" component={DoctorProfileScreen} options={{ title: t('nav.profile') }} />
    </Tab.Navigator>
  )
}
