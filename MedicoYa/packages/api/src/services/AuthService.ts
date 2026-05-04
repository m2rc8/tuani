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
}
