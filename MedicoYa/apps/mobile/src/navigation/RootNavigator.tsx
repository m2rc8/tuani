import React from 'react'
import { useAuthStore } from '../store/authStore'
import AuthStack from './AuthStack'
import PatientTabs from './PatientTabs'
import DoctorTabs from './DoctorTabs'

export default function RootNavigator() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.role)

  if (!token) return <AuthStack />
  if (role === 'doctor') return <DoctorTabs />
  return <PatientTabs />
}
