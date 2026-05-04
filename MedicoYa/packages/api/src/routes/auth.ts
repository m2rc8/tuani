import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { z } from 'zod'
import { AuthService } from '../services/AuthService'
import { Language } from '@prisma/client'

const sendOtpSchema = z.object({
  phone: z.string().min(1),
})

const verifyOtpSchema = z.object({
  phone: z.string().min(1),
  code: z.string().length(6),
})

function parseValidPhone(raw: string): string | null {
  const phone = parsePhoneNumberFromString(raw)
  return phone?.isValid() ? phone.number : null
}

function parseLang(acceptLanguage?: string): Language {
  return acceptLanguage?.startsWith('es') ? Language.es : Language.en
}

export function createAuthRouter(authService: AuthService): Router {
  const router = Router()

  const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 3,
    message: { error: 'Too many OTP requests, try again in 10 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
  })

  router.post(
    '/send-otp',
    otpLimiter,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = sendOtpSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'phone is required' })
        return
      }

      const phone = parseValidPhone(parsed.data.phone)
      if (!phone) {
        res.status(400).json({ error: 'Invalid phone number format' })
        return
      }

      await authService.sendOtp(phone)
      res.status(200).json({ ok: true })
    }
  )

  router.post(
    '/verify-otp',
    async (req: Request, res: Response): Promise<void> => {
      const parsed = verifyOtpSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'phone and 6-digit code are required' })
        return
      }

      const phone = parseValidPhone(parsed.data.phone)
      if (!phone) {
        res.status(400).json({ error: 'Invalid phone number format' })
        return
      }

      const lang = parseLang(req.headers['accept-language'])

      try {
        const result = await authService.verifyOtpAndLogin(
          phone,
          parsed.data.code,
          lang
        )
        res.status(200).json(result)
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'INVALID_CODE') {
          res.status(401).json({ error: 'Invalid or expired code' })
          return
        }
        throw err
      }
    }
  )

  return router
}
