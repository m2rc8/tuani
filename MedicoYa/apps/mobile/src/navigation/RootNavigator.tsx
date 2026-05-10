import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'
import AuthStack from './AuthStack'
import PatientTabs from './PatientTabs'
import WaitingScreen from '../screens/patient/WaitingScreen'
import ConsultationScreen from '../screens/patient/ConsultationScreen'
import PrescriptionScreen from '../screens/patient/PrescriptionScreen'
import VideoCallScreen from '../screens/shared/VideoCallScreen'
import DoctorRoot from './DoctorStack'

export type PatientStackParamList = {
  PatientTabs: undefined
  WaitingScreen: { consultationId: string }
  ConsultationScreen: { consultationId: string }
  PrescriptionScreen: { consultationId: string }
  VideoCallScreen: { consultationId: string }
}

const PatientStack = createNativeStackNavigator<PatientStackParamList>()

function PatientRoot() {
  return (
    <PatientStack.Navigator screenOptions={{ headerShown: false }}>
      <PatientStack.Screen name="PatientTabs" component={PatientTabs} />
      <PatientStack.Screen
        name="WaitingScreen"
        component={WaitingScreen}
        options={{ gestureEnabled: false }}
      />
      <PatientStack.Screen name="ConsultationScreen" component={ConsultationScreen} />
      <PatientStack.Screen name="PrescriptionScreen" component={PrescriptionScreen} />
      <PatientStack.Screen
        name="VideoCallScreen"
        component={VideoCallScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </PatientStack.Navigator>
  )
}

export default function RootNavigator() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.role)

  if (!token) return <AuthStack />
  if (role === 'doctor') return <DoctorRoot />
  return <PatientRoot />
}
