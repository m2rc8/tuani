import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTranslation } from 'react-i18next'
import QueueScreen from '../screens/doctor/QueueScreen'
import DoctorHistoryScreen from '../screens/doctor/HistoryScreen'
import DoctorProfileScreen from '../screens/doctor/DoctorProfileScreen'
import DentalPickerScreen from '../screens/doctor/DentalPickerScreen'
import { tokens } from '../theme/tokens'

const { colors } = tokens

type DoctorTabsParamList = {
  Queue:   undefined
  Dental:  undefined
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
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: { backgroundColor: colors.ui.slate800, borderTopColor: colors.surface.border },
      }}
    >
      <Tab.Screen name="Queue"   component={QueueScreen}          options={{ title: t('nav.queue') }} />
      <Tab.Screen name="Dental"  component={DentalPickerScreen}   options={{ title: t('dental.tab') }} />
      <Tab.Screen name="History" component={DoctorHistoryScreen}  options={{ title: t('nav.history') }} />
      <Tab.Screen name="Profile" component={DoctorProfileScreen}  options={{ title: t('nav.profile') }} />
    </Tab.Navigator>
  )
}
