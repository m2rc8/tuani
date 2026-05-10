import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LoginScreen from '../screens/auth/LoginScreen'
import OtpScreen from '../screens/auth/OtpScreen'
import DoctorRegisterScreen from '../screens/auth/DoctorRegisterScreen'

export type AuthStackParamList = {
  Login: undefined
  Otp: { phone: string }
  DoctorRegister: undefined
}

const Stack = createNativeStackNavigator<AuthStackParamList>()

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="DoctorRegister" component={DoctorRegisterScreen} />
    </Stack.Navigator>
  )
}
