import { ConsultationStatus, User, Doctor, Patient, Consultation, Prescription } from '@prisma/client'
import type { Medication } from '../services/ConsultationService'

type FhirEncounterStatus = 'planned' | 'in-progress' | 'finished' | 'cancelled'

const ENCOUNTER_STATUS: Record<ConsultationStatus, FhirEncounterStatus> = {
  pending:   'planned',
  active:    'in-progress',
  completed: 'finished',
  rejected:  'cancelled',
  cancelled: 'cancelled',
}

export function toFhirEncounter(c: Pick<Consultation,
  'id' | 'patient_id' | 'doctor_id' | 'status' | 'diagnosis' | 'diagnosis_code' | 'created_at' | 'completed_at'
>) {
  return {
    resourceType: 'Encounter' as const,
    id: c.id,
    status: ENCOUNTER_STATUS[c.status],
    class: {
      system:  'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code:    'VR',
      display: 'virtual',
    },
    subject: { reference: `Patient/${c.patient_id}` },
    ...(c.doctor_id && {
      participant: [{ individual: { reference: `Practitioner/${c.doctor_id}` } }],
    }),
    ...(c.diagnosis && {
      reasonCode: [{
        coding: [{
          system:  'http://hl7.org/fhir/sid/icd-10',
          ...(c.diagnosis_code && { code: c.diagnosis_code }),
          display: c.diagnosis,
        }],
        text: c.diagnosis,
      }],
    }),
    period: {
      start: c.created_at.toISOString(),
      ...(c.completed_at && { end: c.completed_at.toISOString() }),
    },
  }
}

export function toFhirPatient(
  user: Pick<User, 'phone' | 'name' | 'preferred_language'>,
  patient: Pick<Patient, 'id' | 'dob'>
) {
  return {
    resourceType: 'Patient' as const,
    id: patient.id,
    telecom: [{ system: 'phone', value: user.phone, use: 'mobile' }],
    ...(user.name && { name: [{ text: user.name }] }),
    ...(patient.dob && { birthDate: patient.dob.toISOString().split('T')[0] }),
    communication: [{
      language: {
        coding: [{ system: 'urn:ietf:bcp:47', code: user.preferred_language }],
      },
      preferred: true,
    }],
  }
}

export function toFhirPractitioner(
  user: Pick<User, 'phone' | 'name'>,
  doctor: Pick<Doctor, 'id' | 'cedula'>
) {
  return {
    resourceType: 'Practitioner' as const,
    id: doctor.id,
    telecom: [{ system: 'phone', value: user.phone }],
    ...(user.name && { name: [{ text: user.name }] }),
    ...(doctor.cedula && {
      identifier: [{
        system: 'urn:oid:2.16.840.1.113883.2.341.1',
        value:  doctor.cedula,
      }],
    }),
  }
}

export function toFhirMedicationBundle(
  prescription: Pick<Prescription, 'id' | 'valid_until'> & { medications: unknown },
  patientId: string,
  now: Date = new Date()
) {
  const meds = prescription.medications as Medication[]
  return {
    resourceType: 'Bundle' as const,
    type: 'collection' as const,
    entry: meds.map((med, i) => ({
      resource: {
        resourceType: 'MedicationRequest' as const,
        id: `${prescription.id}-${i}`,
        status: now <= prescription.valid_until ? 'active' : 'completed',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [{
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            ...(med.code && { code: med.code }),
            display: med.name,
          }],
          text: med.name,
        },
        subject: { reference: `Patient/${patientId}` },
        dosageInstruction: [{ text: `${med.dose} — ${med.frequency}` }],
        dispenseRequest: {
          validityPeriod: { end: prescription.valid_until.toISOString().split('T')[0] },
        },
      },
    })),
  }
}
