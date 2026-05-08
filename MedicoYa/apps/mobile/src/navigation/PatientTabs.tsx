import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTranslation } from 'react-i18next'
import HomeScreen from '../screens/patient/HomeScreen'
import PatientHistoryScreen from '../screens/patient/HistoryScreen'
import PatientProfileScreen from '../screens/patient/PatientProfileScreen'

type PatientTabsParamList = {
  Home: undefined
  History: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<PatientTabsParamList>()

export default function PatientTabs() {
  const { t } = useTranslation()
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t('nav.home') }} />
      <Tab.Screen name="History" component={PatientHistoryScreen} options={{ title: t('nav.history') }} />
      <Tab.Screen name="Profile" component={PatientProfileScreen} options={{ title: t('nav.profile') }} />
    </Tab.Navigator>
  )
}
