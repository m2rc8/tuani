export type ConsultationStatus = 'pending' | 'active' | 'completed' | 'rejected' | 'cancelled'

export interface Medication {
  name: string
  dose: string
  frequency: string
  code?: string
}

export interface Prescription {
  id: string
  consultation_id: string
  qr_code: string
  medications: Medication[]
  instructions: string | null
  valid_until: string
}

export interface Rating {
  id:         string
  stars:      number
  comment:    string | null
  created_at: string
}

export interface ConsultationDetail {
  id: string
  patient_id: string
  doctor_id: string | null
  status: ConsultationStatus
  symptoms_text: string | null
  symptom_photo: string | null
  diagnosis: string | null
  diagnosis_code: string | null
  created_at: string
  completed_at: string | null
  prescription: Prescription | null
  rating: Rating | null
}

export interface Message {
  id: string
  sender_id: string
  content: string
  msg_type: 'text' | 'image'
  created_at: string
}

export interface AvailableDoctor {
  id: string
  available: boolean
  bio: string | null
  user: { name: string | null; phone: string }
}

export interface QueueItem {
  id: string
  status: ConsultationStatus
  symptoms_text: string | null
  created_at: string
  patient: { user: { phone: string } }
}
