export type ToothSurface = 'healthy' | 'caries' | 'filled' | 'missing' | 'crown' | 'indicated_extraction'

export interface ToothRecord {
  id:                 string
  dental_record_id:   string
  tooth_fdi:          number
  surface_mesial:     ToothSurface
  surface_distal:     ToothSurface
  surface_occlusal:   ToothSurface
  surface_vestibular: ToothSurface
  surface_palatal:    ToothSurface
  notes?:             string
}

export interface DentalTreatment {
  id:               string
  dental_record_id: string
  tooth_fdi?:       number
  procedure:        string
  status:           'pending' | 'in_progress' | 'completed'
  priority:         'urgent' | 'elective'
  cost_lps?:        number
  notes?:           string
  materials?:       string[]
  performed_at:     string
}

export interface DentalRecord {
  id:             string
  patient_id:     string
  dentist_id:     string
  brigade_id?:    string
  record_date:    string
  cpod_index?:    number
  hygiene_notes?: string
  created_at:     string
  teeth:          ToothRecord[]
  treatments:     DentalTreatment[]
}
