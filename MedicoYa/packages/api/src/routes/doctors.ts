import { Router, Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/requireAuth'

const availabilitySchema = z.object({ available: z.boolean() })
const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  bio:  z.string().optional(),
})

export function createDoctorsRouter(db: PrismaClient): Router {
  const router = Router()

  router.get(
    '/me',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response, next): Promise<void> => {
      try {
        const [doctor, ratingAgg] = await Promise.all([
          db.doctor.findUnique({
            where:   { id: req.user!.sub },
            include: { user: { select: { name: true, phone: true } } },
          }),
          db.rating.aggregate({
            where:  { doctor_id: req.user!.sub },
            _avg:   { stars: true },
            _count: { stars: true },
          }),
        ])
        if (!doctor) { res.status(404).json({ error: 'Doctor not found' }); return }
        res.json({
          ...doctor,
          avg_rating:   ratingAgg._avg.stars,
          rating_count: ratingAgg._count.stars,
        })
      } catch (err) {
        next(err)
      }
    }
  )

  router.get('/available', requireAuth, async (_req: Request, res: Response): Promise<void> => {
    const doctors = await db.doctor.findMany({
      where: {
        available:   true,
        approved_at: { not: null },
      },
      include: { user: { select: { name: true, phone: true } } },
    })
    res.json(doctors)
  })

  router.put(
    '/me',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response, next): Promise<void> => {
      try {
        const parsed = profileUpdateSchema.safeParse(req.body)
        if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return }
        const { name, bio } = parsed.data
        await Promise.all([
          name !== undefined
            ? db.user.update({ where: { id: req.user!.sub }, data: { name } })
            : Promise.resolve(),
          bio !== undefined
            ? db.doctor.upsert({
                where:  { id: req.user!.sub },
                update: { bio },
                create: { id: req.user!.sub, bio },
              })
            : Promise.resolve(),
        ])
        res.json({ ok: true })
      } catch (err) { next(err) }
    }
  )

  router.put(
    '/availability',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = availabilitySchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'available (boolean) is required' })
        return
      }
      const doctor = await db.doctor.upsert({
        where:  { id: req.user!.sub },
        update: { available: parsed.data.available },
        create: { id: req.user!.sub, available: parsed.data.available },
      })
      res.json(doctor)
    }
  )

  return router
}
