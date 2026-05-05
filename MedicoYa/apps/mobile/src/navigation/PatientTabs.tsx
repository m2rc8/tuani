import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import HomeScreen from '../screens/patient/HomeScreen'
import PatientHistoryScreen from '../screens/patient/HistoryScreen'
import ProfileScreen from '../screens/shared/ProfileScreen'

type PatientTabsParamList = {
  Home: undefined
  History: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<PatientTabsParamList>()

export default function PatientTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="History" component={PatientHistoryScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  )
}
