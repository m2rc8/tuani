import { describe, it, expect, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { requireAuth } from './requireAuth'
import { Language, Role } from '@prisma/client'

const SECRET = 'test-secret-medicoya-min-32-chars-ok'

function makeReqRes(authHeader?: string) {
  const req = {
    headers: { authorization: authHeader },
  } as Request
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  const next = vi.fn() as NextFunction
  return { req, res, next }
}

describe('requireAuth', () => {
  it('returns 401 when Authorization header is missing', () => {
    const { req, res, next } = makeReqRes()
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header has no Bearer prefix', () => {
    const { req, res, next } = makeReqRes('Token abc123')
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token is invalid', () => {
    const { req, res, next } = makeReqRes('Bearer not.a.valid.jwt')
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token is expired', () => {
    const token = jwt.sign(
      { sub: 'user-1', role: Role.patient, preferred_language: Language.es },
      SECRET,
      { expiresIn: '-1s' }
    )
    const { req, res, next } = makeReqRes(`Bearer ${token}`)
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() and sets req.user on valid token', () => {
    const payload = {
      sub: 'user-1',
      role: Role.patient,
      preferred_language: Language.es,
    }
    const token = jwt.sign(payload, SECRET, { expiresIn: '7d' })
    const { req, res, next } = makeReqRes(`Bearer ${token}`)
    requireAuth(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user?.sub).toBe('user-1')
    expect(req.user?.role).toBe(Role.patient)
    expect(req.user?.preferred_language).toBe(Language.es)
  })
})
