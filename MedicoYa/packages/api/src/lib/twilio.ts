import twilio from 'twilio'

let _client: ReturnType<typeof twilio> | null = null

export function getTwilioClient() {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) {
      throw new Error(
        'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set in production'
      )
    }
    _client = twilio(sid, token)
  }
  return _client
}

export function getTwilioVerifySid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID
  if (!sid) {
    throw new Error('TWILIO_VERIFY_SERVICE_SID must be set in production')
  }
  return sid
}
