import { describe, it, expect } from 'vitest'
import { toFhirEncounter, toFhirPatient, toFhirPractitioner, toFhirMedicationBundle } from './fhir'
import { ConsultationStatus, Language } from '@prisma/client'

const PATIENT_ID = 'patient-uuid-1'
const DOCTOR_ID  = 'doctor-uuid-1'
const CONSULT_ID = 'consult-uuid-1'
const PRESC_ID   = 'presc-uuid-1'

const baseConsultation = {
  id: CONSULT_ID,
  patient_id: PATIENT_ID,
  doctor_id: DOCTOR_ID,
  status: ConsultationStatus.active,
  diagnosis: null,
  diagnosis_code: null,
  created_at: new Date('2026-05-04T10:00:00Z'),
  completed_at: null,
}

describe('toFhirEncounter', () => {
  it('maps active consultation to in-progress Encounter', () => {
    const result = toFhirEncounter({ ...baseConsultation })
    expect(result.resourceType).toBe('Encounter')
    expect(result.id).toBe(CONSULT_ID)
    expect(result.status).toBe('in-progress')
    expect(result.subject.reference).toBe(`Patient/${PATIENT_ID}`)
  })

  it('maps completed consultation to finished', () => {
    const result = toFhirEncounter({ ...baseConsultation, status: ConsultationStatus.completed })
    expect(result.status).toBe('finished')
  })

  it('maps pending consultation to planned', () => {
    const result = toFhirEncounter({ ...baseConsultation, status: ConsultationStatus.pending })
    expect(result.status).toBe('planned')
  })

  it('maps rejected/cancelled to cancelled', () => {
    expect(toFhirEncounter({ ...baseConsultation, status: ConsultationStatus.rejected }).status).toBe('cancelled')
    expect(toFhirEncounter({ ...baseConsultation, status: ConsultationStatus.cancelled }).status).toBe('cancelled')
  })

  it('includes participant reference when doctor_id set', () => {
    const result = toFhirEncounter({ ...baseConsultation })
    expect(result.participant?.[0]?.individual?.reference).toBe(`Practitioner/${DOCTOR_ID}`)
  })

  it('includes reasonCode when diagnosis present', () => {
    const result = toFhirEncounter({
      ...baseConsultation, diagnosis: 'Flu', diagnosis_code: 'J10.1',
    })
    expect(result.reasonCode?.[0]?.text).toBe('Flu')
    expect(result.reasonCode?.[0]?.coding?.[0]?.code).toBe('J10.1')
  })

  it('includes period.end when completed_at present', () => {
    const completedAt = new Date('2026-05-04T11:00:00Z')
    const result = toFhirEncounter({ ...baseConsultation, completed_at: completedAt })
    expect(result.period.end).toBe(completedAt.toISOString())
  })
})

describe('toFhirPatient', () => {
  const user    = { phone: '+50499000001', name: 'Ana López', preferred_language: Language.es }
  const patient = { id: PATIENT_ID, dob: new Date('1990-03-15'), allergies: null, registered_by: null, registration_mode: 'self' as const }

  it('maps patient with phone and name', () => {
    const result = toFhirPatient(user as any, patient as any)
    expect(result.resourceType).toBe('Patient')
    expect(result.id).toBe(PATIENT_ID)
    expect(result.telecom[0].value).toBe('+50499000001')
    expect(result.name?.[0]?.text).toBe('Ana López')
  })

  it('includes birthDate when dob present', () => {
    const result = toFhirPatient(user as any, patient as any)
    expect(result.birthDate).toBe('1990-03-15')
  })

  it('includes preferred language in communication', () => {
    const result = toFhirPatient(user as any, patient as any)
    expect(result.communication[0].language.coding[0].code).toBe('es')
  })
})

describe('toFhirPractitioner', () => {
  const user   = { phone: '+50499000002', name: 'Dr. Juan Paz', preferred_language: Language.es }
  const doctor = { id: DOCTOR_ID, cedula: '12345', cmh_verified: true, available: true, bio: null, approved_at: new Date() }

  it('maps practitioner with cedula identifier', () => {
    const result = toFhirPractitioner(user as any, doctor as any)
    expect(result.resourceType).toBe('Practitioner')
    expect(result.id).toBe(DOCTOR_ID)
    expect(result.identifier?.[0]?.value).toBe('12345')
  })

  it('omits identifier when no cedula', () => {
    const result = toFhirPractitioner(user as any, { ...doctor, cedula: null } as any)
    expect(result.identifier).toBeUndefined()
  })
})

describe('toFhirMedicationBundle', () => {
  const prescription = {
    id: PRESC_ID,
    consultation_id: CONSULT_ID,
    qr_code: 'ABC123',
    medications: [
      { name: 'Ibuprofen', dose: '400mg', frequency: 'every 8h', code: '5640' },
      { name: 'Omeprazole', dose: '20mg', frequency: 'daily' },
    ],
    instructions: 'Take with food',
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    created_at: new Date(),
  }

  it('returns Bundle resourceType', () => {
    const result = toFhirMedicationBundle(prescription as any, PATIENT_ID)
    expect(result.resourceType).toBe('Bundle')
    expect(result.type).toBe('collection')
  })

  it('creates one entry per medication', () => {
    const result = toFhirMedicationBundle(prescription as any, PATIENT_ID)
    expect(result.entry).toHaveLength(2)
    expect(result.entry[0].resource.resourceType).toBe('MedicationRequest')
  })

  it('includes RxNorm code when provided', () => {
    const result = toFhirMedicationBundle(prescription as any, PATIENT_ID)
    expect(result.entry[0].resource.medicationCodeableConcept.coding[0].code).toBe('5640')
  })

  it('omits code field when not provided', () => {
    const result = toFhirMedicationBundle(prescription as any, PATIENT_ID)
    expect(result.entry[1].resource.medicationCodeableConcept.coding[0].code).toBeUndefined()
  })

  it('sets status active for non-expired prescription', () => {
    const result = toFhirMedicationBundle(prescription as any, PATIENT_ID)
    expect(result.entry[0].resource.status).toBe('active')
  })

  it('sets status completed for expired prescription', () => {
    const expired = { ...prescription, valid_until: new Date(Date.now() - 1000) }
    const result  = toFhirMedicationBundle(expired as any, PATIENT_ID)
    expect(result.entry[0].resource.status).toBe('completed')
  })
})
