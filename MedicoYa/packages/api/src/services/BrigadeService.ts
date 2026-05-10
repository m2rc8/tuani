import crypto from 'crypto'
import {
  PrismaClient, Brigade, BrigadeStatus,
  ConsultationMode, ConsultationStatus, RegistrationMode, Role,
} from '@prisma/client'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateJoinCode(): string {
  const bytes = crypto.randomBytes(6)
  return Array.from(bytes).map(b => CHARS[b % 36]).join('')
}

export interface CreateBrigadeInput {
  name: string
  community: string
  municipality?: string
  department?: string
  start_date: string
  end_date: string
  brigade_type?: string
}

export interface SyncItem {
  local_id:       string
  patient_phone?: string
  patient_dob?:   string
  patient_name:   string
  symptoms_text?: string
  diagnosis?:     string
  referral_to?:   string
  medications?:   { name: string; dose: string; frequency: string }[]
  created_at:     string
}

export interface SyncResult {
  accepted: string[]
  rejected: { local_id: string; reason: string }[]
}

export interface BrigadeDashboard {
  total:          number
  attended:       number
  waiting:        number
  active_doctors: number
}

export class BrigadeService {
  constructor(private db: PrismaClient) {}

  async createBrigade(organizerId: string, data: CreateBrigadeInput): Promise<Brigade> {
    const build = (code: string) => ({
      id:           crypto.randomUUID(),
      name:         data.name,
      organizer_id: organizerId,
      community:    data.community,
      municipality: data.municipality,
      department:   data.department,
      start_date:   new Date(data.start_date),
      end_date:     new Date(data.end_date),
      join_code:    code,
      brigade_type: data.brigade_type ?? 'medical',
    })
    try {
      return await this.db.brigade.create({ data: build(generateJoinCode()) })
    } catch (err: any) {
      if (err?.code === 'P2002' && (err?.meta?.target as string[])?.includes('join_code')) {
        return await this.db.brigade.create({ data: build(generateJoinCode()) })
      }
      throw err
    }
  }

  async joinBrigade(doctorId: string, brigadeId: string, joinCode: string): Promise<void> {
    const brigade = await this.db.brigade.findUnique({ where: { id: brigadeId } })
    if (!brigade || brigade.join_code.toUpperCase() !== joinCode.toUpperCase()) {
      const err = new Error('Invalid join code') as any
      err.code = 'INVALID_CODE'
      throw err
    }
    const existing = await this.db.brigadeDoctor.findUnique({
      where: { brigade_id_doctor_id: { brigade_id: brigadeId, doctor_id: doctorId } },
    })
    if (existing) {
      const err = new Error('Already joined') as any
      err.code = 'ALREADY_JOINED'
      throw err
    }
    await this.db.brigadeDoctor.create({ data: { brigade_id: brigadeId, doctor_id: doctorId } })
  }

  async getDashboard(brigadeId: string): Promise<BrigadeDashboard> {
    const today    = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)

    const [total, attended, waiting, activeDoctorRows] = await Promise.all([
      this.db.consultation.count({ where: { brigade_id: brigadeId } }),
      this.db.consultation.count({ where: { brigade_id: brigadeId, status: ConsultationStatus.completed } }),
      this.db.consultation.count({ where: { brigade_id: brigadeId, status: ConsultationStatus.pending } }),
      this.db.consultation.findMany({
        where:    { brigade_id: brigadeId, created_at: { gte: today, lt: tomorrow }, doctor_id: { not: null } },
        select:   { doctor_id: true },
        distinct: ['doctor_id'],
      }),
    ])
    return { total, attended, waiting, active_doctors: activeDoctorRows.length }
  }

  async getReport(brigadeId: string) {
    const [topDiagnoses, patientCount, selfCount, brigadeCount, brigade, totalConsultations, medRows] = await Promise.all([
      this.db.consultation.groupBy({
        by:      ['diagnosis'],
        where:   { brigade_id: brigadeId, diagnosis: { not: null } },
        _count:  { diagnosis: true },
        orderBy: { _count: { diagnosis: 'desc' } },
        take:    10,
      }),
      this.db.patient.count({ where: { consultations: { some: { brigade_id: brigadeId } } } }),
      this.db.patient.count({
        where: { registration_mode: RegistrationMode.self, consultations: { some: { brigade_id: brigadeId } } },
      }),
      this.db.patient.count({
        where: { registration_mode: RegistrationMode.brigade_doctor, consultations: { some: { brigade_id: brigadeId } } },
      }),
      this.db.brigade.findUnique({
        where:  { id: brigadeId },
        select: { name: true, community: true, start_date: true, end_date: true },
      }),
      this.db.consultation.count({ where: { brigade_id: brigadeId } }),
      this.db.$queryRaw<{ name: string; count: bigint }[]>`
        SELECT m->>'name' AS name, COUNT(*) AS count
        FROM prescriptions p
        JOIN consultations c ON c.id = p.consultation_id
        CROSS JOIN LATERAL jsonb_array_elements(p.medications) AS m
        WHERE c.brigade_id = ${brigadeId}::uuid
        GROUP BY m->>'name'
        ORDER BY count DESC
        LIMIT 5
      `,
    ])
    return {
      brigade_name:         brigade?.name ?? '',
      community:            brigade?.community ?? '',
      start_date:           brigade?.start_date ?? null,
      end_date:             brigade?.end_date ?? null,
      patient_count:        patientCount,
      total_consultations:  totalConsultations,
      by_registration_mode: { self: selfCount, brigade_doctor: brigadeCount },
      top_diagnoses:        topDiagnoses.map(d => ({ diagnosis: d.diagnosis!, count: d._count.diagnosis })),
      top_medications:      medRows.map(r => ({ name: r.name, count: Number(r.count) })),
    }
  }

  async syncConsultations(doctorId: string, brigadeId: string, items: SyncItem[]): Promise<SyncResult> {
    const accepted: string[] = []
    const rejected: { local_id: string; reason: string }[] = []

    for (const item of items) {
      try {
        // Generate placeholder phone for patients without one
        const phone = item.patient_phone ?? `BRG-${crypto.randomUUID().slice(0, 8)}`

        // If no real phone, try to find existing patient by name+dob before creating
        let user: { id: string }
        if (!item.patient_phone && item.patient_dob) {
          const dob = new Date(item.patient_dob)
          const existing = await this.db.patient.findFirst({
            where: {
              user: { name: item.patient_name },
              dob: { gte: new Date(dob.getFullYear(), dob.getMonth(), dob.getDate()), lt: new Date(dob.getFullYear(), dob.getMonth(), dob.getDate() + 1) },
            },
            select: { id: true },
          })
          if (existing) {
            user = existing
          } else {
            const created = await this.db.user.create({
              data: { id: crypto.randomUUID(), phone, name: item.patient_name, role: Role.patient },
            })
            await this.db.patient.create({
              data: { id: created.id, registered_by: doctorId, registration_mode: RegistrationMode.brigade_doctor, dob: dob },
            })
            user = created
          }
        } else {
          user = await this.db.user.upsert({
            where:  { phone },
            create: { id: crypto.randomUUID(), phone, name: item.patient_name, role: Role.patient },
            update: {},
          })
          await this.db.patient.upsert({
            where:  { id: user.id },
            create: { id: user.id, registered_by: doctorId, registration_mode: RegistrationMode.brigade_doctor },
            update: {},
          })
        }

        await this.db.$transaction(async (tx) => {
          const consultation = await tx.consultation.create({
            data: {
              id:            crypto.randomUUID(),
              patient_id:    user.id,
              doctor_id:     doctorId,
              mode:          ConsultationMode.brigade,
              brigade_id:    brigadeId,
              local_id:      item.local_id,
              status:        ConsultationStatus.completed,
              symptoms_text: item.symptoms_text,
              diagnosis:     item.diagnosis,
              referral_to:   item.referral_to,
              synced_at:     new Date(),
              created_at:    new Date(item.created_at),
            },
          })
          if (item.medications && item.medications.length > 0) {
            await tx.prescription.create({
              data: {
                id:              crypto.randomUUID(),
                consultation_id: consultation.id,
                qr_code:         crypto.randomUUID(),
                medications:     item.medications,
                valid_until:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day validity
              },
            })
          }
        })
        accepted.push(item.local_id)
      } catch (err: any) {
        rejected.push({ local_id: item.local_id, reason: err?.message ?? 'Unknown error' })
      }
    }
    return { accepted, rejected }
  }

  async getMyBrigades(doctorId: string) {
    const rows = await this.db.brigadeDoctor.findMany({
      where:   { doctor_id: doctorId },
      include: { brigade: { select: { id: true, name: true, community: true, status: true, brigade_type: true, organizer_id: true } } },
      orderBy: { joined_at: 'desc' },
    })
    return rows.map(r => ({ ...r.brigade, joined_at: r.joined_at, is_organizer: r.brigade.organizer_id === doctorId }))
  }

  async getBrigadeByCode(code: string) {
    return this.db.brigade.findFirst({
      where:  { join_code: code.trim().toUpperCase() },
      select: {
        id: true, name: true, community: true, municipality: true,
        department: true, start_date: true, end_date: true, status: true,
      },
    })
  }

  async getMyBrigadesCoordinator(organizerId: string): Promise<{
    id: string
    name: string
    community: string
    status: BrigadeStatus
    join_code: string
    brigade_type: string
  }[]> {
    return this.db.brigade.findMany({
      where:   { organizer_id: organizerId },
      select:  { id: true, name: true, community: true, status: true, join_code: true, brigade_type: true },
      orderBy: { start_date: 'desc' },
    })
  }

  async updateBrigade(id: string, organizerId: string, data: Record<string, any>) {
    const brigade = await this.db.brigade.findUnique({ where: { id } })
    if (!brigade) throw new Error('NOT_FOUND')
    if (brigade.organizer_id !== organizerId) throw new Error('FORBIDDEN')
    return this.db.brigade.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.community && { community: data.community }),
        ...(data.municipality !== undefined && { municipality: data.municipality }),
        ...(data.department !== undefined && { department: data.department }),
        ...(data.start_date && { start_date: new Date(data.start_date) }),
        ...(data.end_date && { end_date: new Date(data.end_date) }),
        ...(data.brigade_type && { brigade_type: data.brigade_type }),
        ...(data.status && { status: data.status as any }),
      },
    })
  }

  async getBrigadeSeed(brigadeId: string) {
    const brigade = await this.db.brigade.findUnique({
      where:   { id: brigadeId },
      include: {
        doctors: {
          include: { doctor: { include: { user: { select: { name: true } } } } },
        },
      },
    })
    if (!brigade) return null

    const consultationPatients = await this.db.consultation.findMany({
      where:   { brigade_id: brigadeId },
      select:  { patient: { select: { user: { select: { phone: true, name: true } } } } },
      orderBy: [{ synced_at: 'desc' }, { created_at: 'desc' }],
      take:    500,
    })
    const seen = new Set<string>()
    const patients = consultationPatients
      .map(c => ({ phone: c.patient.user.phone, name: c.patient.user.name ?? '' }))
      .filter(p => { if (seen.has(p.phone)) return false; seen.add(p.phone); return true })

    return {
      brigade: {
        id:           brigade.id,
        name:         brigade.name,
        community:    brigade.community,
        municipality: brigade.municipality,
        department:   brigade.department,
        start_date:   brigade.start_date,
        end_date:     brigade.end_date,
        status:       brigade.status,
      },
      doctors:  brigade.doctors.map(bd => ({ id: bd.doctor_id, name: bd.doctor.user.name ?? '' })),
      patients,
    }
  }
}
