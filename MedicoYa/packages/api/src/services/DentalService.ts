import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const ADULT_TEETH = [
  11,12,13,14,15,16,17,18,
  21,22,23,24,25,26,27,28,
  31,32,33,34,35,36,37,38,
  41,42,43,44,45,46,47,48,
]

export interface CreateDentalRecordInput {
  patient_id:    string
  brigade_id?:   string
  hygiene_notes?: string
}

export interface UpdateTeethInput {
  teeth: {
    tooth_fdi:          number
    surface_mesial?:    string
    surface_distal?:    string
    surface_occlusal?:  string
    surface_vestibular?: string
    surface_palatal?:   string
    notes?:             string
  }[]
}

export interface AddTreatmentInput {
  tooth_fdi?:  number
  procedure:   string
  status?:     string
  priority?:   string
  cost_lps?:   number
  notes?:      string
  materials?:  string[]
}

export class DentalService {
  constructor(private db: PrismaClient) {}

  async createRecord(dentistId: string, input: CreateDentalRecordInput) {
    const id = crypto.randomUUID()
    const record = await this.db.dentalRecord.create({
      data: {
        id,
        patient_id:    input.patient_id,
        dentist_id:    dentistId,
        brigade_id:    input.brigade_id,
        hygiene_notes: input.hygiene_notes,
        teeth: {
          create: ADULT_TEETH.map(fdi => ({
            id:       crypto.randomUUID(),
            tooth_fdi: fdi,
          })),
        },
      },
      include: { teeth: true, treatments: true },
    })
    return record
  }

  async getPatientRecords(patientId: string) {
    return this.db.dentalRecord.findMany({
      where:   { patient_id: patientId },
      include: { teeth: true, treatments: true },
      orderBy: { record_date: 'desc' },
    })
  }

  async getRecord(recordId: string) {
    return this.db.dentalRecord.findUnique({
      where:   { id: recordId },
      include: { teeth: true, treatments: true },
    })
  }

  async updateTeeth(recordId: string, input: UpdateTeethInput) {
    await Promise.all(
      input.teeth.map(t =>
        this.db.toothRecord.updateMany({
          where: { dental_record_id: recordId, tooth_fdi: t.tooth_fdi },
          data:  {
            surface_mesial:     t.surface_mesial,
            surface_distal:     t.surface_distal,
            surface_occlusal:   t.surface_occlusal,
            surface_vestibular: t.surface_vestibular,
            surface_palatal:    t.surface_palatal,
            notes:              t.notes,
          },
        })
      )
    )
    return this.getRecord(recordId)
  }

  async addTreatment(recordId: string, input: AddTreatmentInput) {
    return this.db.dentalTreatment.create({
      data: {
        id:               crypto.randomUUID(),
        dental_record_id: recordId,
        tooth_fdi:        input.tooth_fdi,
        procedure:        input.procedure,
        status:           input.status    ?? 'completed',
        priority:         input.priority  ?? 'elective',
        cost_lps:         input.cost_lps,
        notes:            input.notes,
        materials:        input.materials ?? [],
      },
    })
  }

  async getBrigadeDentalReport(brigadeId: string) {
    const records = await this.db.dentalRecord.findMany({
      where:   { brigade_id: brigadeId },
      include: { teeth: true, treatments: true },
    })

    const totalPatients    = records.length
    const totalTreatments  = records.reduce((sum, r) => sum + r.treatments.length, 0)

    const procedureCounts: Record<string, number> = {}
    for (const r of records) {
      for (const t of r.treatments) {
        procedureCounts[t.procedure] = (procedureCounts[t.procedure] ?? 0) + 1
      }
    }
    const topProcedures = Object.entries(procedureCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([procedure, count]) => ({ procedure, count }))

    return { total_patients: totalPatients, total_treatments: totalTreatments, top_procedures: topProcedures }
  }
}
