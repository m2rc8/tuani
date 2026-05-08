import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const updateProfileSchema = z.object({
  name:      z.string().min(1).max(100).optional(),
  dob:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  allergies: z.string().max(500).nullable().optional(),
})

export type UpdateProfileData = z.infer<typeof updateProfileSchema>

export interface PatientProfile {
  name:      string | null
  phone:     string
  dob:       Date | null
  allergies: string | null
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
      name:      user.name,
      phone:     user.phone,
      dob:       user.patient.dob,
      allergies: user.patient.allergies,
    }
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<PatientProfile> {
    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data:  { name: data.name },
      }),
      this.db.patient.update({
        where: { id: userId },
        data: {
          dob:       data.dob !== undefined ? (data.dob ? new Date(data.dob) : null) : undefined,
          allergies: data.allergies !== undefined ? data.allergies : undefined,
        },
      }),
    ])
    return this.getProfile(userId)
  }
}
