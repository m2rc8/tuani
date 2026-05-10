export type ToothSurface = 'healthy' | 'caries' | 'filled' | 'missing' | 'crown' | 'indicated_extraction'

export interface ToothRecord {
  id:                 string
  file_id:            string
  tooth_fdi:          number
  surface_mesial:     ToothSurface
  surface_distal:     ToothSurface
  surface_occlusal:   ToothSurface
  surface_vestibular: ToothSurface
  surface_palatal:    ToothSurface
  notes?:             string
}

export interface DentalTreatment {
  id:                string
  visit_id:          string
  tooth_fdi?:        number
  procedure:         string
  status:            'pending' | 'in_progress' | 'completed'
  priority:          'urgent' | 'elective'
  cost_lps?:         number
  notes?:            string
  materials?:        string[]
  performed_at:      string
  started_at?:       string | null
  ended_at?:         string | null
  before_image_url?: string | null
  after_image_url?:  string | null
}

export interface DentistSummary {
  name?:       string | null
  first_name?: string | null
  last_name?:  string | null
}

export interface DentalVisit {
  id:              string
  file_id:         string
  dentist_id:      string
  brigade_id?:     string
  visit_date:      string
  hygiene_notes?:  string | null
  cpod_index?:     number | null
  treatment_plan?: string | null
  referral_to?:    string | null
  treatments:      DentalTreatment[]
  dentist?:        DentistSummary
}

export interface DentalPatientFile {
  id:         string
  patient_id: string
  created_at: string
  updated_at: string
  teeth:      ToothRecord[]
  visits:     DentalVisit[]
}
