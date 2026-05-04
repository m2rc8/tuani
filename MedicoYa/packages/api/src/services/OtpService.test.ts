import { describe, it, expect } from 'vitest'
import { DevOtpService } from './OtpService'

describe('DevOtpService', () => {
  it('accepts code 123456 after sendOtp', async () => {
    const svc = new DevOtpService()
    await svc.sendOtp('+50499000000')
    const valid = await svc.verifyOtp('+50499000000', '123456')
    expect(valid).toBe(true)
  })

  it('rejects wrong code', async () => {
    const svc = new DevOtpService()
    await svc.sendOtp('+50499000000')
    const valid = await svc.verifyOtp('+50499000000', '000000')
    expect(valid).toBe(false)
  })

  it('rejects phone that never sent OTP', async () => {
    const svc = new DevOtpService()
    const valid = await svc.verifyOtp('+50499000000', '123456')
    expect(valid).toBe(false)
  })

  it('each instance has isolated code storage', async () => {
    const svc1 = new DevOtpService()
    const svc2 = new DevOtpService()
    await svc1.sendOtp('+50499000000')
    const valid = await svc2.verifyOtp('+50499000000', '123456')
    expect(valid).toBe(false)
  })
})
