import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/requireAuth'

export function createAdminRouter(db: PrismaClient): Router {
  const router = Router()

  router.get(
    '/doctors/pending',
    requireAuth,
    requireRole(Role.admin),
    async (_req: Request, res: Response): Promise<void> => {
      const doctors = await db.doctor.findMany({
        where:   { approved_at: null, rejected_at: null },
        include: { user: { select: { name: true, phone: true } } },
      })
      res.json(doctors)
    }
  )

  router.get(
    '/doctors/approved',
    requireAuth,
    requireRole(Role.admin),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const [doctors, ratings] = await Promise.all([
          db.doctor.findMany({
            where:   { approved_at: { not: null }, rejected_at: null },
            include: { user: { select: { name: true, phone: true } } },
          }),
          db.rating.groupBy({
            by:     ['doctor_id'],
            _avg:   { stars: true },
            _count: { stars: true },
          }),
        ])
        const ratingMap = new Map(ratings.map(r => [r.doctor_id, r]))
        res.json(doctors.map(d => {
          const r = ratingMap.get(d.id)
          return {
            ...d,
            avg_rating:   r?._avg.stars   ?? null,
            rating_count: r?._count.stars ?? 0,
          }
        }))
      } catch (err) { next(err) }
    }
  )

  router.put(
    '/doctors/:id/approve',
    requireAuth,
    requireRole(Role.admin),
    async (req: Request, res: Response): Promise<void> => {
      const doctor = await db.doctor.update({
        where: { id: req.params.id },
        data:  { approved_at: new Date() },
      })
      res.json(doctor)
    }
  )

  router.put(
    '/doctors/:id/reject',
    requireAuth,
    requireRole(Role.admin),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const doctor = await db.doctor.update({
          where: { id: req.params.id },
          data:  { rejected_at: new Date() },
        })
        res.json(doctor)
      } catch {
        res.status(404).json({ error: 'Doctor not found' })
      }
    }
  )

  router.get(
    '/consultations',
    requireAuth,
    requireRole(Role.admin),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const dateStr = typeof req.query.date === 'string'
        ? req.query.date
        : new Date().toISOString().split('T')[0]
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' })
        return
      }
      try {
        const start = new Date(`${dateStr}T00:00:00.000Z`)
        const end   = new Date(`${dateStr}T23:59:59.999Z`)
        const consultations = await db.consultation.findMany({
          where:   { created_at: { gte: start, lte: end } },
          include: {
            patient: { include: { user: { select: { name: true, phone: true } } } },
            doctor:  { include: { user: { select: { name: true, phone: true } } } },
          },
          orderBy: { created_at: 'desc' },
        })
        res.json(consultations)
      } catch (err) { next(err) }
    }
  )

  // ── User management ─────────────────────────────────────────────────────────

  router.get(
    '/users',
    requireAuth,
    requireRole(Role.admin),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const q     = typeof req.query.q    === 'string' ? req.query.q.trim()    : ''
        const role  = typeof req.query.role === 'string' ? req.query.role.trim() : ''
        const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10))
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)))
        const skip  = (page - 1) * limit

        const where: any = {}
        if (role && Object.values(Role).includes(role as Role)) where.role = role as Role
        if (q) {
          where.OR = [
            { name:  { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ]
        }

        const [users, total] = await Promise.all([
          db.user.findMany({
            where,
            select: {
              id: true, phone: true, name: true, first_name: true, last_name: true,
              role: true, preferred_language: true, created_at: true,
              doctor:  { select: { approved_at: true, rejected_at: true, available: true, cedula: true } },
              patient: { select: { id: true } },
            },
            orderBy: { created_at: 'desc' },
            skip,
            take: limit,
          }),
          db.user.count({ where }),
        ])

        res.json({ users, total, page, limit })
      } catch (err) { next(err) }
    }
  )

  router.get(
    '/users/:id',
    requireAuth,
    requireRole(Role.admin),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = await db.user.findUnique({
          where:  { id: req.params.id },
          select: {
            id: true, phone: true, name: true, first_name: true, last_name: true,
            role: true, preferred_language: true, created_at: true,
            doctor: {
              select: {
                approved_at: true, rejected_at: true, available: true,
                cedula: true, bio: true, cmh_verified: true,
              },
            },
            patient: {
              select: {
                id: true, dob: true, allergies: true, registration_mode: true,
              },
            },
          },
        })
        if (!user) { res.status(404).json({ error: 'User not found' }); return }

        const consultationCount = user.patient
          ? await db.consultation.count({ where: { patient_id: user.patient.id } })
          : user.doctor
            ? await db.consultation.count({ where: { doctor_id: user.id } })
            : 0

        res.json({ ...user, consultation_count: consultationCount })
      } catch (err) { next(err) }
    }
  )

  router.patch(
    '/users/:id',
    requireAuth,
    requireRole(Role.admin),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const schema = z.object({
        name:       z.string().min(1).max(100).optional(),
        first_name: z.string().max(60).optional(),
        last_name:  z.string().max(60).optional(),
        role:       z.enum(['patient', 'doctor', 'coordinator']).optional(),
      })
      const parsed = schema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request' }); return }
      try {
        const user = await db.user.update({
          where:  { id: req.params.id },
          data:   parsed.data,
          select: { id: true, phone: true, name: true, role: true, created_at: true },
        })
        res.json(user)
      } catch (err: any) {
        if (err?.code === 'P2025') { res.status(404).json({ error: 'User not found' }); return }
        next(err)
      }
    }
  )

  return router
}
