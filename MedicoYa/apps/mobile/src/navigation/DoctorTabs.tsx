import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import QueueScreen from '../screens/doctor/QueueScreen'
import DoctorHistoryScreen from '../screens/doctor/HistoryScreen'
import ProfileScreen from '../screens/shared/ProfileScreen'

type DoctorTabsParamList = {
  Queue: undefined
  History: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<DoctorTabsParamList>()

export default function DoctorTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Queue" component={QueueScreen} options={{ title: 'Cola' }} />
      <Tab.Screen name="History" component={DoctorHistoryScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  )
}
