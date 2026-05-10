import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import DoctorTabs from './DoctorTabs'
import DoctorConsultationScreen from '../screens/doctor/DoctorConsultationScreen'
import WriteRxScreen from '../screens/doctor/WriteRxScreen'
import PrescriptionScreen from '../screens/patient/PrescriptionScreen'
import BrigadeHomeScreen from '../screens/doctor/BrigadeHomeScreen'
import BrigadeQueueScreen from '../screens/doctor/BrigadeQueueScreen'
import BrigadeConsultationScreen from '../screens/doctor/BrigadeConsultationScreen'
import VideoCallScreen from '../screens/shared/VideoCallScreen'
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
  VideoCallScreen: { consultationId: string }
}

const Stack = createNativeStackNavigator<DoctorStackParamList>()

const headerOptions = {
  headerStyle: { backgroundColor: colors.ui.slate800 },
  headerTintColor: colors.brand.green400,
  headerTitleStyle: { fontFamily: 'DMSansSemibold', fontSize: typography.size.base, color: colors.text.primary },
}

export default function DoctorRoot() {
  const { t } = useTranslation()
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DoctorTabs" component={DoctorTabs} />
      <Stack.Screen
        name="DoctorConsultationScreen"
        component={DoctorConsultationScreen}
        options={{ headerShown: true, title: t('doctor.consultation_title'), ...headerOptions }}
      />
      <Stack.Screen
        name="WriteRxScreen"
        component={WriteRxScreen}
        options={{ headerShown: true, title: t('doctor.rx_title'), ...headerOptions }}
      />
      <Stack.Screen
        name="PrescriptionScreen"
        component={PrescriptionScreen}
        options={{ headerShown: true, title: t('consultation.prescription_title'), ...headerOptions }}
      />
      <Stack.Screen
        name="BrigadeHomeScreen"
        component={BrigadeHomeScreen}
        options={{ headerShown: true, title: t('brigade.title'), ...headerOptions }}
      />
      <Stack.Screen
        name="BrigadeQueueScreen"
        component={BrigadeQueueScreen}
        options={{ headerShown: true, title: t('brigade.session_title'), ...headerOptions }}
      />
      <Stack.Screen
        name="BrigadeConsultationScreen"
        component={BrigadeConsultationScreen}
        options={{ headerShown: true, title: t('brigade.new_consultation_title'), ...headerOptions }}
      />
      <Stack.Screen
        name="VideoCallScreen"
        component={VideoCallScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </Stack.Navigator>
  )
}
