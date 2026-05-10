import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import DoctorTabs from './DoctorTabs'
import DoctorConsultationScreen from '../screens/doctor/DoctorConsultationScreen'
import WriteRxScreen from '../screens/doctor/WriteRxScreen'
import PrescriptionScreen from '../screens/patient/PrescriptionScreen'
import BrigadeHomeScreen from '../screens/doctor/BrigadeHomeScreen'
import BrigadeQueueScreen from '../screens/doctor/BrigadeQueueScreen'
import BrigadeConsultationScreen from '../screens/doctor/BrigadeConsultationScreen'
import { tokens } from '../theme/tokens'

const { colors, typography } = tokens

export type DoctorStackParamList = {
  DoctorTabs: undefined
  DoctorConsultationScreen: { consultationId: string }
  WriteRxScreen: { consultationId: string }
  PrescriptionScreen: { consultationId: string }
  BrigadeHomeScreen: undefined
  BrigadeQueueScreen: undefined
  BrigadeConsultationScreen: { local_id?: string }
}

const Stack = createNativeStackNavigator<DoctorStackParamList>()

export default function DoctorRoot() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DoctorTabs" component={DoctorTabs} />
      <Stack.Screen
        name="DoctorConsultationScreen"
        component={DoctorConsultationScreen}
        options={{
          headerShown: true,
          title: 'En consulta',
          headerStyle: { backgroundColor: colors.ui.white },
          headerTintColor: colors.brand.green400,
          headerTitleStyle: { fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
        }}
      />
      <Stack.Screen
        name="WriteRxScreen"
        component={WriteRxScreen}
        options={{
          headerShown: true,
          title: 'Completar consulta',
          headerStyle: { backgroundColor: colors.ui.white },
          headerTintColor: colors.brand.green400,
          headerTitleStyle: { fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
        }}
      />
      <Stack.Screen
        name="PrescriptionScreen"
        component={PrescriptionScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.ui.white },
          headerTintColor: colors.brand.green400,
          headerTitleStyle: { fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
        }}
      />
      <Stack.Screen
        name="BrigadeHomeScreen"
        component={BrigadeHomeScreen}
        options={{
          headerShown: true,
          title: 'Brigadas',
          headerStyle: { backgroundColor: colors.ui.white },
          headerTintColor: colors.brand.green400,
          headerTitleStyle: { fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
        }}
      />
      <Stack.Screen
        name="BrigadeQueueScreen"
        component={BrigadeQueueScreen}
        options={{
          headerShown: true,
          title: 'Brigada',
          headerStyle: { backgroundColor: colors.ui.white },
          headerTintColor: colors.brand.green400,
          headerTitleStyle: { fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
        }}
      />
      <Stack.Screen
        name="BrigadeConsultationScreen"
        component={BrigadeConsultationScreen}
        options={{
          headerShown: true,
          title: 'Nueva consulta',
          headerStyle: { backgroundColor: colors.ui.white },
          headerTintColor: colors.brand.green400,
          headerTitleStyle: { fontFamily: 'DMSansSemibold', fontSize: typography.size.base },
        }}
      />
    </Stack.Navigator>
  )
}
