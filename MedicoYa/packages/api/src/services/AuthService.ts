import { PrismaClient, Language, Role } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { OtpService } from './OtpService'

export interface AuthUser {
  id: string
  role: Role
  name: string | null
  preferred_language: Language
}

export interface LoginResult {
  token: string
  user: AuthUser
}

export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly db: PrismaClient
  ) {}

  async sendOtp(phone: string): Promise<void> {
    await this.otp.sendOtp(phone)
  }

  async registerDoctor(
    phone: string,
    code: string,
    name: string,
    cedula: string,
    lang?: Language
  ): Promise<LoginResult> {
    const valid = await this.otp.verifyOtp(phone, code)
    if (!valid) throw new Error('INVALID_CODE')

    const user = await this.db.user.upsert({
      where:  { phone },
      update: { role: Role.doctor, name },
      create: { phone, role: Role.doctor, name, preferred_language: lang ?? Language.es },
    })

    await this.db.doctor.upsert({
      where:  { id: user.id },
      update: { cedula },
      create: { id: user.id, cedula },
    })

    const token = jwt.sign(
      { sub: user.id, role: user.role, preferred_language: user.preferred_language },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    return {
      token,
      user: { id: user.id, role: user.role, name: user.name, preferred_language: user.preferred_language },
    }
  }

  async verifyOtpAndLogin(
    phone: string,
    code: string,
    lang?: Language
  ): Promise<LoginResult> {
    const valid = await this.otp.verifyOtp(phone, code)
    if (!valid) throw new Error('INVALID_CODE')

    const user = await this.db.user.upsert({
      where: { phone },
      update: lang ? { preferred_language: lang } : {},
      create: {
        phone,
        role: Role.patient,
        preferred_language: lang ?? Language.es,
      },
    })

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        preferred_language: user.preferred_language,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    return {
      token,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        preferred_language: user.preferred_language,
      },
    }
  }

  async updateLanguage(userId: string, language: Language): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { preferred_language: language } })
  }
}
