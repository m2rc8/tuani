import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const updateProfileSchema = z.object({
  first_name: z.string().min(1).max(60).optional(),
  last_name:  z.string().min(1).max(60).optional(),
  dob:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  allergies:  z.string().max(500).nullable().optional(),
})

export type UpdateProfileData = z.infer<typeof updateProfileSchema>

export interface PatientProfile {
  first_name: string | null
  last_name:  string | null
  name:       string | null
  phone:      string
  dob:        Date | null
  allergies:  string | null
}

export class PatientError extends Error {
  constructor(public readonly code: 'NOT_FOUND', message: string) {
    super(message)
    this.name = 'PatientError'
  }
}

export class PatientService {
  constructor(private readonly db: PrismaClient) {}

  async getProfile(userId: string): Promise<PatientProfile> {
    const user = await this.db.user.findUnique({
      where:   { id: userId },
      include: { patient: { select: { dob: true, allergies: true } } },
    })
    if (!user || !user.patient) throw new PatientError('NOT_FOUND', 'Patient not found')
    return {
      first_name: user.first_name,
      last_name:  user.last_name,
      name:       user.name,
      phone:      user.phone,
      dob:        user.patient.dob,
      allergies:  user.patient.allergies,
    }
  }

  async getByPhone(phone: string): Promise<{ id: string; first_name: string | null; last_name: string | null; name: string | null; phone: string } | null> {
    const user = await this.db.user.findFirst({
      where:  { phone, patient: { isNot: null } },
      select: { id: true, first_name: true, last_name: true, name: true, phone: true },
    })
    return user ?? null
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<PatientProfile> {
    await this.getProfile(userId)

    const { first_name, last_name, dob, allergies } = data
    const fullName = [first_name, last_name].filter(Boolean).join(' ') || undefined

    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: {
          ...(first_name !== undefined ? { first_name } : {}),
          ...(last_name  !== undefined ? { last_name }  : {}),
          ...(fullName   !== undefined ? { name: fullName } : {}),
        },
      }),
      this.db.patient.update({
        where: { id: userId },
        data: {
          dob:       dob !== undefined ? (dob ? new Date(dob) : null) : undefined,
          allergies: allergies !== undefined ? allergies : undefined,
        },
      }),
    ])
    return this.getProfile(userId)
  }
}
