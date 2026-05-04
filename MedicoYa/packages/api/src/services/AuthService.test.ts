import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from './AuthService'
import { DevOtpService } from './OtpService'
import { Language, Role } from '@prisma/client'

const PHONE = '+50499000000'

const mockUser = {
  id: 'user-uuid-1',
  phone: PHONE,
  name: null,
  role: Role.patient,
  preferred_language: Language.es,
  created_at: new Date(),
}

const mockPrisma = {
  user: {
    upsert: vi.fn().mockResolvedValue(mockUser),
  },
}

describe('AuthService', () => {
  let otp: DevOtpService
  let svc: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    otp = new DevOtpService()
    svc = new AuthService(otp, mockPrisma as any)
  })

  it('returns token and user on valid code', async () => {
    await otp.sendOtp(PHONE)
    const result = await svc.verifyOtpAndLogin(PHONE, '123456')
    expect(result.token).toBeTruthy()
    expect(typeof result.token).toBe('string')
    expect(result.user.id).toBe('user-uuid-1')
    expect(result.user.role).toBe(Role.patient)
    expect(result.user.preferred_language).toBe(Language.es)
  })

  it('throws INVALID_CODE on wrong code', async () => {
    await otp.sendOtp(PHONE)
    await expect(
      svc.verifyOtpAndLogin(PHONE, '000000')
    ).rejects.toThrow('INVALID_CODE')
  })

  it('throws INVALID_CODE when no OTP was sent', async () => {
    await expect(
      svc.verifyOtpAndLogin(PHONE, '123456')
    ).rejects.toThrow('INVALID_CODE')
  })

  it('calls prisma.user.upsert with phone', async () => {
    await otp.sendOtp(PHONE)
    await svc.verifyOtpAndLogin(PHONE, '123456')
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { phone: PHONE } })
    )
  })

  it('passes preferred_language to upsert when provided', async () => {
    await otp.sendOtp(PHONE)
    await svc.verifyOtpAndLogin(PHONE, '123456', Language.en)
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { preferred_language: Language.en },
        create: expect.objectContaining({ preferred_language: Language.en }),
      })
    )
  })

  it('uses Language.es as default when lang not provided', async () => {
    await otp.sendOtp(PHONE)
    await svc.verifyOtpAndLogin(PHONE, '123456')
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {},
        create: expect.objectContaining({ preferred_language: Language.es }),
      })
    )
  })
})
