import { RequestHandler } from 'express'
import { PrismaClient } from '@prisma/client'

export function requireBrigadeMember(db: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    try {
      const row = await db.brigadeDoctor.findUnique({
        where: {
          brigade_id_doctor_id: {
            brigade_id: req.params.id,
            doctor_id:  req.user!.sub,
          },
        },
      })
      if (!row) { res.status(403).json({ error: 'Forbidden' }); return }
      next()
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export function requireBrigadeOwner(db: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    try {
      const brigade = await db.brigade.findUnique({ where: { id: req.params.id } })
      if (!brigade || brigade.organizer_id !== req.user!.sub) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      next()
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}
