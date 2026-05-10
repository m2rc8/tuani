import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

const ADULT_TEETH = [
  11,12,13,14,15,16,17,18,
  21,22,23,24,25,26,27,28,
  31,32,33,34,35,36,37,38,
  41,42,43,44,45,46,47,48,
]

export interface UpsertToothInput {
  tooth_fdi:           number
  surface_mesial?:     string
  surface_distal?:     string
  surface_occlusal?:   string
  surface_vestibular?: string
  surface_palatal?:    string
  notes?:              string
}

export interface AddTreatmentInput {
  tooth_fdi?:  number
  procedure:   string
  status?:     string
  priority?:   string
  cost_lps?:   number
  notes?:      string
  materials?:  string[]
  started_at?: string
  ended_at?:   string
}

export interface UpdateVisitInput {
  hygiene_notes?:  string | null
  cpod_index?:     number | null
  treatment_plan?: string | null
  referral_to?:    string | null
}

export class DentalService {
  constructor(private db: PrismaClient) {}

  // ── File ────────────────────────────────────────────────────────────────────

  async createFile(patientId: string) {
    return this.db.dentalPatientFile.create({
      data: {
        id:         crypto.randomUUID(),
        patient_id: patientId,
        teeth: {
          create: ADULT_TEETH.map(fdi => ({
            id:        crypto.randomUUID(),
            tooth_fdi: fdi,
          })),
        },
      },
      include: { teeth: true, visits: { include: { treatments: true } } },
    })
  }

  async getFileByPatient(patientId: string) {
    return this.db.dentalPatientFile.findUnique({
      where:   { patient_id: patientId },
      include: {
        teeth: true,
        visits: {
          include: {
            treatments: true,
            dentist:    { select: { name: true, first_name: true, last_name: true } },
          },
          orderBy: { visit_date: 'desc' },
        },
      },
    })
  }

  async getFile(fileId: string) {
    return this.db.dentalPatientFile.findUnique({
      where:   { id: fileId },
      include: {
        teeth: true,
        visits: {
          include: {
            treatments: true,
            dentist:    { select: { name: true, first_name: true, last_name: true } },
          },
          orderBy: { visit_date: 'desc' },
        },
      },
    })
  }

  // ── Teeth ───────────────────────────────────────────────────────────────────

  async upsertTeeth(fileId: string, teeth: UpsertToothInput[]) {
    await Promise.all(
      teeth.map(t =>
        this.db.toothRecord.upsert({
          where:  { file_id_tooth_fdi: { file_id: fileId, tooth_fdi: t.tooth_fdi } },
          create: {
            id:                 crypto.randomUUID(),
            file_id:            fileId,
            tooth_fdi:          t.tooth_fdi,
            surface_mesial:     t.surface_mesial     ?? 'healthy',
            surface_distal:     t.surface_distal     ?? 'healthy',
            surface_occlusal:   t.surface_occlusal   ?? 'healthy',
            surface_vestibular: t.surface_vestibular ?? 'healthy',
            surface_palatal:    t.surface_palatal    ?? 'healthy',
            notes:              t.notes,
          },
          update: {
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
    return this.getFile(fileId)
  }

  // ── Visits ──────────────────────────────────────────────────────────────────

  async createVisit(fileId: string, dentistId: string, brigadeId?: string) {
    return this.db.dentalVisit.create({
      data: {
        id:         crypto.randomUUID(),
        file_id:    fileId,
        dentist_id: dentistId,
        brigade_id: brigadeId,
      },
      include: { treatments: true },
    })
  }

  async getVisit(visitId: string) {
    return this.db.dentalVisit.findUnique({
      where:   { id: visitId },
      include: { treatments: true },
    })
  }

  async updateVisit(visitId: string, input: UpdateVisitInput) {
    return this.db.dentalVisit.update({
      where:   { id: visitId },
      data:    {
        hygiene_notes:  input.hygiene_notes,
        cpod_index:     input.cpod_index,
        treatment_plan: input.treatment_plan,
        referral_to:    input.referral_to,
      },
      include: { treatments: true },
    })
  }

  async getDentistVisits(dentistId: string) {
    return this.db.dentalVisit.findMany({
      where:   { dentist_id: dentistId },
      include: {
        file: {
          include: {
            patient: { include: { user: { select: { name: true, first_name: true, last_name: true } } } },
          },
        },
        treatments: { select: { id: true } },
      },
      orderBy: { visit_date: 'desc' },
      take:    100,
    })
  }

  // ── Treatments ──────────────────────────────────────────────────────────────

  async addTreatment(visitId: string, input: AddTreatmentInput) {
    return this.db.dentalTreatment.create({
      data: {
        id:         crypto.randomUUID(),
        visit_id:   visitId,
        tooth_fdi:  input.tooth_fdi,
        procedure:  input.procedure,
        status:     input.status   ?? 'completed',
        priority:   input.priority ?? 'elective',
        cost_lps:   input.cost_lps,
        notes:      input.notes,
        materials:  input.materials ?? [],
        started_at: input.started_at ? new Date(input.started_at) : undefined,
        ended_at:   input.ended_at   ? new Date(input.ended_at)   : undefined,
      },
    })
  }

  async updateTreatmentImage(treatmentId: string, type: 'before' | 'after', url: string) {
    return this.db.dentalTreatment.update({
      where: { id: treatmentId },
      data:  type === 'before' ? { before_image_url: url } : { after_image_url: url },
    })
  }

  // ── Minor patients ──────────────────────────────────────────────────────────

  async searchMinorPatients(q: string) {
    return this.db.user.findMany({
      where: {
        phone: { startsWith: 'DENTAL-' },
        name:  { contains: q, mode: 'insensitive' },
      },
      select: { patient: { select: { id: true } }, name: true, first_name: true, last_name: true },
      take: 20,
    })
  }

  // ── Brigade report ──────────────────────────────────────────────────────────

  async getBrigadeDentalReport(brigadeId: string) {
    const visits = await this.db.dentalVisit.findMany({
      where:   { brigade_id: brigadeId },
      include: { treatments: true },
    })
    const totalPatients   = new Set(visits.map(v => v.file_id)).size
    const totalTreatments = visits.reduce((sum, v) => sum + v.treatments.length, 0)
    const procedureCounts: Record<string, number> = {}
    for (const v of visits) {
      for (const t of v.treatments) {
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
