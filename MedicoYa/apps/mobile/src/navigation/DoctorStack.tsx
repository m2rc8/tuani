import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import DoctorTabs from './DoctorTabs'
import DoctorConsultationScreen from '../screens/doctor/DoctorConsultationScreen'
import WriteRxScreen from '../screens/doctor/WriteRxScreen'
import PrescriptionScreen from '../screens/patient/PrescriptionScreen'

export type DoctorStackParamList = {
  DoctorTabs: undefined
  DoctorConsultationScreen: { consultationId: string }
  WriteRxScreen: { consultationId: string }
  PrescriptionScreen: { consultationId: string }
}

const Stack = createNativeStackNavigator<DoctorStackParamList>()

export default function DoctorRoot() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DoctorTabs" component={DoctorTabs} />
      <Stack.Screen
        name="DoctorConsultationScreen"
        component={DoctorConsultationScreen}
        options={{ headerShown: true, title: 'En consulta' }}
      />
      <Stack.Screen
        name="WriteRxScreen"
        component={WriteRxScreen}
        options={{ headerShown: true, title: 'Completar consulta' }}
      />
      <Stack.Screen
        name="PrescriptionScreen"
        component={PrescriptionScreen}
        options={{ headerShown: true }}
      />
    </Stack.Navigator>
  )
}
