import { getTwilioClient, TWILIO_VERIFY_SID } from '../lib/twilio'

export interface OtpService {
  sendOtp(phone: string): Promise<void>
  verifyOtp(phone: string, code: string): Promise<boolean>
}

export class DevOtpService implements OtpService {
  private readonly codes = new Map<string, string>()

  async sendOtp(phone: string): Promise<void> {
    this.codes.set(phone, '123456')
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    return this.codes.get(phone) === code
  }
}

export class TwilioOtpService implements OtpService {
  async sendOtp(phone: string): Promise<void> {
    await getTwilioClient()
      .verify.v2.services(TWILIO_VERIFY_SID)
      .verifications.create({ to: phone, channel: 'sms' })
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const check = await getTwilioClient()
      .verify.v2.services(TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: phone, code })
    return check.status === 'approved'
  }
}

export const otpService: OtpService =
  process.env.NODE_ENV === 'development'
    ? new DevOtpService()
    : new TwilioOtpService()
