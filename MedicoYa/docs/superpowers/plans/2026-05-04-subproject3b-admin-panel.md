# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js admin panel (static export served by Express) with OTP login, doctor approval/rejection, and a live-refreshing consultations view.

**Architecture:** Next.js 14 App Router with `output: 'export'` and `basePath: '/admin'` builds to `apps/admin/out/`. The Express API serves those static files at `/admin`. React Query handles data fetching with `invalidateQueries` on mutations and 30s auto-refetch on the consultations page. JWT from `verify-otp` is stored in `localStorage`; all API calls inject it as a Bearer token. Three new API endpoints are TDD'd first before the frontend is built.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS 3, `@tanstack/react-query` 5, TypeScript 5, Vitest + supertest (for API endpoint tests), Express `express.static`.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/api/prisma/schema.prisma` | MODIFY | Add `rejected_at DateTime?` to Doctor |
| `packages/api/src/routes/admin.ts` | MODIFY | Add 3 new endpoints; fix pending filter |
| `packages/api/src/routes/admin.test.ts` | MODIFY | Tests for 3 new endpoints |
| `packages/api/src/app.ts` | MODIFY | Mount `express.static` for admin panel |
| `package.json` (root) | MODIFY | Add `build:admin`, `build`, `start` scripts |
| `.gitignore` | MODIFY | Ignore `apps/admin/.next/` and `apps/admin/out/` |
| `apps/admin/package.json` | CREATE | Next.js workspace package |
| `apps/admin/next.config.ts` | CREATE | `output: 'export'`, `basePath: '/admin'` |
| `apps/admin/tsconfig.json` | CREATE | Next.js TypeScript config |
| `apps/admin/tailwind.config.ts` | CREATE | Tailwind content paths |
| `apps/admin/postcss.config.js` | CREATE | Tailwind + autoprefixer |
| `apps/admin/src/app/globals.css` | CREATE | Tailwind directives |
| `apps/admin/.env.local` | CREATE | `NEXT_PUBLIC_API_URL` for local dev |
| `apps/admin/src/lib/auth.ts` | CREATE | `getToken` / `setToken` / `clearToken` |
| `apps/admin/src/lib/api.ts` | CREATE | `apiFetch` wrapper (Bearer token, 401 handler) |
| `apps/admin/src/providers.tsx` | CREATE | `ReactQueryProvider` |
| `apps/admin/src/components/Sidebar.tsx` | CREATE | Nav links + logout |
| `apps/admin/src/app/layout.tsx` | CREATE | Auth guard + shell |
| `apps/admin/src/components/OtpForm.tsx` | CREATE | Phone → OTP two-step login form |
| `apps/admin/src/app/page.tsx` | CREATE | Login page |
| `apps/admin/src/components/DoctorsTable.tsx` | CREATE | Pending/Active tabs with approve/reject |
| `apps/admin/src/app/doctors/page.tsx` | CREATE | Doctors page |
| `apps/admin/src/components/ConsultationsTable.tsx` | CREATE | Auto-refreshing consultations table |
| `apps/admin/src/app/consultations/page.tsx` | CREATE | Consultations page |

---

## Task 1: Schema — add rejected_at to Doctor

**Files:**
- Modify: `packages/api/prisma/schema.prisma`
- Modify: `packages/api/src/routes/admin.ts` (pending filter only)

**Context:** The Doctor model currently has `approved_at DateTime?`. We need `rejected_at DateTime?` so the reject endpoint can record it, and so rejected doctors are excluded from the pending list.

- [ ] **Step 1: Add field to schema**

Edit `packages/api/prisma/schema.prisma`. Replace the `Doctor` model block:

```prisma
model Doctor {
  id           String    @id
  user         User      @relation(fields: [id], references: [id])
  cedula       String?   @unique
  cmh_verified Boolean   @default(false)
  available    Boolean   @default(false)
  bio          String?
  approved_at  DateTime?
  rejected_at  DateTime?

  consultations Consultation[]
}
```

- [ ] **Step 2: Generate Prisma client**

Run from the monorepo root (`C:/Users/macho/OneDrive/Documentos/Desarollos/MedicoYa`):

```bash
npm --workspace packages/api run db:generate
```

Expected: `Prisma Client generated` with no errors. (Migration runs separately against a real DB; for tests the generated client is enough.)

- [ ] **Step 3: Fix the pending doctors filter in admin.ts**

The existing `GET /api/admin/doctors/pending` handler filters only `approved_at: null`. It must also exclude rejected doctors. Open `packages/api/src/routes/admin.ts` and update the `findMany` call:

```typescript
const doctors = await db.doctor.findMany({
  where:   { approved_at: null, rejected_at: null },
  include: { user: { select: { name: true, phone: true } } },
})
```

- [ ] **Step 4: Run existing tests**

```bash
npm test
```

Expected: 108 passed, 0 failed. The pending test still passes because `mockDb.doctor.findMany` is mocked regardless of the `where` clause.

- [ ] **Step 5: Commit**

```bash
git add packages/api/prisma/schema.prisma packages/api/src/routes/admin.ts
git commit -m "feat: add rejected_at to Doctor schema, exclude rejected from pending list"
```

---

## Task 2: API — three new admin endpoints (TDD)

**Files:**
- Modify: `packages/api/src/routes/admin.test.ts`
- Modify: `packages/api/src/routes/admin.ts`

**Context:** The existing `admin.test.ts` uses `mockDb = { doctor: { findMany, update, findUnique } }` and `createApp({ db: mockDb })`. We add `consultation.findMany` to the mock and write tests for all three new endpoints before implementing them.

- [ ] **Step 1: Add tests**

Replace the entire contents of `packages/api/src/routes/admin.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language, ConsultationStatus, PaymentStatus } from '@prisma/client'

const SECRET   = 'test-secret-medicoya-min-32-chars-ok'
const ADMIN_ID = 'admin-uuid-1'
const DOC_ID   = 'doctor-uuid-1'
const PAT_ID   = 'patient-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockDb = {
  doctor: {
    findMany:   vi.fn(),
    update:     vi.fn(),
    findUnique: vi.fn(),
  },
  consultation: {
    findMany: vi.fn(),
  },
}

function makeTestApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/admin/doctors/pending', () => {
  it('returns 403 for patient role', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns 403 for doctor role', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(403)
  })

  it('returns pending doctors for admin', async () => {
    mockDb.doctor.findMany.mockResolvedValue([{ id: DOC_ID, approved_at: null, rejected_at: null }])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('PUT /api/admin/doctors/:id/approve', () => {
  it('returns 403 for non-admin', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/${DOC_ID}/approve`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('sets approved_at for admin', async () => {
    mockDb.doctor.update.mockResolvedValue({ id: DOC_ID, approved_at: new Date() })
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/${DOC_ID}/approve`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(mockDb.doctor.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DOC_ID } })
    )
  })
})

describe('GET /api/admin/doctors/approved', () => {
  it('returns 403 for non-admin', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/approved')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns approved doctors for admin', async () => {
    mockDb.doctor.findMany.mockResolvedValue([
      { id: DOC_ID, approved_at: new Date(), available: true, user: { name: 'Dr. Juan', phone: '+50499000001' } },
    ])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/approved')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].available).toBe(true)
  })
})

describe('PUT /api/admin/doctors/:id/reject', () => {
  it('returns 403 for non-admin', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/${DOC_ID}/reject`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('sets rejected_at for admin', async () => {
    mockDb.doctor.update.mockResolvedValue({ id: DOC_ID, rejected_at: new Date() })
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/${DOC_ID}/reject`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(mockDb.doctor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOC_ID },
        data:  expect.objectContaining({ rejected_at: expect.any(Date) }),
      })
    )
  })

  it('returns 404 when doctor not found', async () => {
    mockDb.doctor.update.mockRejectedValue(new Error('Not found'))
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/nonexistent/reject`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/admin/consultations', () => {
  const mockConsultation = {
    id: 'consult-1',
    status: ConsultationStatus.active,
    created_at: new Date(),
    payment_status: PaymentStatus.pending,
    patient: { id: PAT_ID, user: { name: 'María', phone: '+50499111111' } },
    doctor:  { id: DOC_ID, user: { name: 'Dr. Juan', phone: '+50499000001' } },
  }

  it('returns 403 for non-admin', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/consultations')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns consultations for today when no date param', async () => {
    mockDb.consultation.findMany.mockResolvedValue([mockConsultation])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/consultations')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].status).toBe('active')
  })

  it('accepts explicit date param', async () => {
    mockDb.consultation.findMany.mockResolvedValue([])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/consultations?date=2026-01-01')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(mockDb.consultation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          created_at: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    )
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: the 5 new test cases fail with `404` or similar (routes not implemented yet). Existing 8 tests still pass.

- [ ] **Step 3: Implement the three new endpoints**

Replace the entire contents of `packages/api/src/routes/admin.ts` with:

```typescript
import { Router, Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
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
    async (_req: Request, res: Response): Promise<void> => {
      const doctors = await db.doctor.findMany({
        where:   { approved_at: { not: null } },
        include: { user: { select: { name: true, phone: true } } },
      })
      res.json(doctors)
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
    async (req: Request, res: Response): Promise<void> => {
      const dateStr = typeof req.query.date === 'string'
        ? req.query.date
        : new Date().toISOString().split('T')[0]
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
    }
  )

  return router
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: 116 passed (108 existing + 8 new), 0 failed.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/admin.ts packages/api/src/routes/admin.test.ts
git commit -m "feat: add approved/reject doctor and consultations admin endpoints (TDD)"
```

---

## Task 3: Admin app scaffold

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/next.config.ts`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/tailwind.config.ts`
- Create: `apps/admin/postcss.config.js`
- Create: `apps/admin/src/app/globals.css`
- Create: `apps/admin/.env.local`
- Modify: `.gitignore`

- [ ] **Step 1: Create `apps/admin/package.json`**

```json
{
  "name": "@medicoya/admin",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@tanstack/react-query": "^5",
    "next": "14.2.29",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10",
    "postcss": "^8",
    "tailwindcss": "^3",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `apps/admin/next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output:        'export',
  basePath:      '/admin',
  trailingSlash: true,
  images:        { unoptimized: true },
}

export default nextConfig
```

`trailingSlash: true` makes Next.js output `doctors/index.html` so `express.static` can serve it as a directory index.

- [ ] **Step 3: Create `apps/admin/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `apps/admin/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme:   { extend: {} },
  plugins: [],
}

export default config
```

- [ ] **Step 5: Create `apps/admin/postcss.config.js`**

```javascript
module.exports = {
  plugins: {
    tailwindcss:  {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 6: Create `apps/admin/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Create `apps/admin/.env.local`**

```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

This makes API calls go to the Express server during local dev. In production the variable is unset, so calls use the same-origin relative path.

- [ ] **Step 8: Update `.gitignore`**

Add two lines to the root `.gitignore`:

```
apps/admin/.next/
apps/admin/out/
```

- [ ] **Step 9: Install dependencies**

```bash
npm install
```

Expected: `added N packages` with no errors. The `@medicoya/admin` workspace appears in the install output.

- [ ] **Step 10: Commit**

```bash
git add apps/admin/package.json apps/admin/next.config.ts apps/admin/tsconfig.json \
        apps/admin/tailwind.config.ts apps/admin/postcss.config.js \
        apps/admin/src/app/globals.css apps/admin/.env.local .gitignore \
        package-lock.json
git commit -m "feat: scaffold Next.js admin app with Tailwind and React Query"
```

---

## Task 4: Auth utilities + React Query provider

**Files:**
- Create: `apps/admin/src/lib/auth.ts`
- Create: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/providers.tsx`

- [ ] **Step 1: Create `apps/admin/src/lib/auth.ts`**

```typescript
const KEY = 'medicoya_admin_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(KEY)
}
```

`typeof window === 'undefined'` guard is required because Next.js runs component code during the static build, where `localStorage` doesn't exist.

- [ ] **Step 2: Create `apps/admin/src/lib/api.ts`**

```typescript
import { getToken, clearToken } from './auth'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (res.status === 401) {
    clearToken()
    window.location.href = '/admin'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}
```

On `401` the function clears the JWT and hard-redirects to `/admin` (the login page). `window.location.href` is used instead of `router.replace` because this utility runs outside React components.

- [ ] **Step 3: Create `apps/admin/src/providers.tsx`**

```typescript
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient())
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
```

`useState` with a factory ensures a single `QueryClient` instance per component mount, required by React Query docs.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/lib/auth.ts apps/admin/src/lib/api.ts apps/admin/src/providers.tsx
git commit -m "feat: add auth utilities and React Query provider for admin app"
```

---

## Task 5: Shell — layout + Sidebar

**Files:**
- Create: `apps/admin/src/components/Sidebar.tsx`
- Create: `apps/admin/src/app/layout.tsx`

- [ ] **Step 1: Create `apps/admin/src/components/Sidebar.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearToken } from '../lib/auth'

const NAV = [
  { href: '/doctors',       label: 'Médicos' },
  { href: '/consultations', label: 'Consultas' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  function logout() {
    clearToken()
    router.replace('/')
  }

  return (
    <aside className="w-48 min-h-screen bg-slate-900 flex flex-col p-4 shrink-0">
      <div className="text-sky-400 font-bold text-sm mb-6">MédicoYa Admin</div>
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2 rounded text-sm transition-colors ${
              pathname === href
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <button
        onClick={logout}
        className="text-slate-500 text-xs px-3 py-2 hover:text-white text-left transition-colors"
      >
        Cerrar sesión
      </button>
    </aside>
  )
}
```

- [ ] **Step 2: Create `apps/admin/src/app/layout.tsx`**

```typescript
'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getToken } from '../lib/auth'
import Providers from '../providers'
import Sidebar from '../components/Sidebar'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const token = getToken()
    if (!token && pathname !== '/') router.replace('/')
    if (token  && pathname === '/') router.replace('/doctors')
  }, [pathname, router])

  const isLogin = pathname === '/'

  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-200 min-h-screen">
        <Providers>
          <div className="flex min-h-screen">
            {!isLogin && <Sidebar />}
            <main className="flex-1 p-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
```

`pathname` from `usePathname()` does NOT include the `basePath` — Next.js strips it automatically. So `/admin/doctors` → `pathname === '/doctors'`.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/Sidebar.tsx apps/admin/src/app/layout.tsx
git commit -m "feat: add admin shell — layout with auth guard and sidebar navigation"
```

---

## Task 6: Login page

**Files:**
- Create: `apps/admin/src/components/OtpForm.tsx`
- Create: `apps/admin/src/app/page.tsx`

- [ ] **Step 1: Create `apps/admin/src/components/OtpForm.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setToken } from '../lib/auth'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function OtpForm() {
  const [phone,   setPhone]   = useState('')
  const [code,    setCode]    = useState('')
  const [step,    setStep]    = useState<'phone' | 'code'>('phone')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function sendOtp() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/auth/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Error al enviar código'); return }
      setStep('code')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone, code }),
      })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Código inválido'); return }
      if (body.user?.role !== 'admin') {
        setError('Acceso denegado. Solo administradores.')
        return
      }
      setToken(body.token)
      router.replace('/doctors')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6 flex flex-col gap-4">
      {step === 'phone' ? (
        <>
          <label className="text-sm text-slate-400">Número de teléfono</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendOtp()}
            placeholder="+50499000000"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            onClick={sendOtp}
            disabled={loading || !phone.trim()}
            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded px-4 py-2 font-medium transition-colors"
          >
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        </>
      ) : (
        <>
          <label className="text-sm text-slate-400">Código OTP (6 dígitos)</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && code.length === 6 && verifyOtp()}
            placeholder="123456"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 tracking-widest focus:outline-none focus:border-sky-500"
          />
          <button
            onClick={verifyOtp}
            disabled={loading || code.length !== 6}
            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded px-4 py-2 font-medium transition-colors"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>
          <button
            onClick={() => { setStep('phone'); setCode('') }}
            className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
          >
            ← Cambiar teléfono
          </button>
        </>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `apps/admin/src/app/page.tsx`**

```typescript
import OtpForm from '../components/OtpForm'

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen -m-8">
      <div className="w-full max-w-sm px-4">
        <h1 className="text-2xl font-bold text-center mb-8 text-sky-400">MédicoYa Admin</h1>
        <OtpForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/OtpForm.tsx apps/admin/src/app/page.tsx
git commit -m "feat: add admin login page with two-step OTP form"
```

---

## Task 7: Doctors page

**Files:**
- Create: `apps/admin/src/components/DoctorsTable.tsx`
- Create: `apps/admin/src/app/doctors/page.tsx`

- [ ] **Step 1: Create `apps/admin/src/components/DoctorsTable.tsx`**

```typescript
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFetch } from '../lib/api'

interface DoctorUser { name: string | null; phone: string }
interface Doctor {
  id: string; cedula: string | null; available: boolean
  approved_at: string | null; user: DoctorUser
}

export default function DoctorsTable() {
  const [tab, setTab] = useState<'pending' | 'approved'>('pending')
  const qc = useQueryClient()

  const { data: pending = [], isLoading: loadingPending } = useQuery<Doctor[]>({
    queryKey: ['doctors', 'pending'],
    queryFn:  () => apiFetch('/api/admin/doctors/pending'),
    enabled:  tab === 'pending',
  })

  const { data: approved = [], isLoading: loadingApproved } = useQuery<Doctor[]>({
    queryKey: ['doctors', 'approved'],
    queryFn:  () => apiFetch('/api/admin/doctors/approved'),
    enabled:  tab === 'approved',
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/doctors/${id}/approve`, { method: 'PUT' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/doctors/${id}/reject`, { method: 'PUT' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  })

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            tab === 'pending' ? 'bg-sky-500 text-white' : 'border border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          Pendientes ({pending.length})
        </button>
        <button
          onClick={() => setTab('approved')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            tab === 'approved' ? 'bg-sky-500 text-white' : 'border border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          Activos
        </button>
      </div>

      {tab === 'pending' && (
        loadingPending ? (
          <p className="text-slate-500">Cargando...</p>
        ) : pending.length === 0 ? (
          <p className="text-slate-500">No hay médicos pendientes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map(doc => (
              <div key={doc.id} className="bg-slate-900 rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{doc.user.name ?? 'Sin nombre'}</p>
                  <p className="text-slate-400 text-sm">
                    Cédula: {doc.cedula ?? '—'} · {doc.user.phone}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approveMutation.mutate(doc.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded transition-colors"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(doc.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded transition-colors"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'approved' && (
        loadingApproved ? (
          <p className="text-slate-500">Cargando...</p>
        ) : approved.length === 0 ? (
          <p className="text-slate-500">No hay médicos activos.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {approved.map(doc => (
              <div key={doc.id} className="bg-slate-900 rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{doc.user.name ?? 'Sin nombre'}</p>
                  <p className="text-slate-400 text-sm">
                    Cédula: {doc.cedula ?? '—'} · {doc.user.phone}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  doc.available ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'
                }`}>
                  {doc.available ? 'Disponible' : 'No disponible'}
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `apps/admin/src/app/doctors/page.tsx`**

```typescript
import DoctorsTable from '../../components/DoctorsTable'

export default function DoctorsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Médicos</h1>
      <DoctorsTable />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/DoctorsTable.tsx apps/admin/src/app/doctors/page.tsx
git commit -m "feat: add doctors page with pending/active tabs, approve/reject actions"
```

---

## Task 8: Consultations page

**Files:**
- Create: `apps/admin/src/components/ConsultationsTable.tsx`
- Create: `apps/admin/src/app/consultations/page.tsx`

- [ ] **Step 1: Create `apps/admin/src/components/ConsultationsTable.tsx`**

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

interface CUser { name: string | null; phone: string }
interface CPatient { id: string; user: CUser }
interface CDoctor  { id: string; user: CUser }
interface Consultation {
  id: string
  status: 'pending' | 'active' | 'completed' | 'rejected' | 'cancelled'
  created_at: string
  patient: CPatient
  doctor:  CDoctor | null
}

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-blue-900   text-blue-300',
  active:    'bg-yellow-900 text-yellow-300',
  completed: 'bg-green-900  text-green-300',
  rejected:  'bg-red-900    text-red-300',
  cancelled: 'bg-red-900    text-red-300',
}

export default function ConsultationsTable() {
  const today = new Date().toISOString().split('T')[0]

  const { data = [], isLoading, dataUpdatedAt } = useQuery<Consultation[]>({
    queryKey:       ['consultations', today],
    queryFn:        () => apiFetch(`/api/admin/consultations?date=${today}`),
    refetchInterval: 30_000,
  })

  const ago = dataUpdatedAt
    ? `hace ${Math.round((Date.now() - dataUpdatedAt) / 1000)}s`
    : '—'

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Consultas hoy</h1>
        <span className="text-slate-500 text-sm">↻ {ago}</span>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : data.length === 0 ? (
        <p className="text-slate-500">No hay consultas hoy.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-800">
                <th className="pb-3 pr-6 font-medium">Paciente</th>
                <th className="pb-3 pr-6 font-medium">Médico</th>
                <th className="pb-3 pr-6 font-medium">Estado</th>
                <th className="pb-3       font-medium">Hora</th>
              </tr>
            </thead>
            <tbody>
              {data.map(c => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                  <td className="py-3 pr-6">
                    {c.patient.user.name ?? c.patient.user.phone}
                  </td>
                  <td className="py-3 pr-6">
                    {c.doctor?.user.name ?? <span className="text-slate-500">—</span>}
                  </td>
                  <td className="py-3 pr-6">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[c.status] ?? ''}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400">
                    {new Date(c.created_at).toLocaleTimeString('es-HN', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `apps/admin/src/app/consultations/page.tsx`**

```typescript
import ConsultationsTable from '../../components/ConsultationsTable'

export default function ConsultationsPage() {
  return <ConsultationsTable />
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/ConsultationsTable.tsx apps/admin/src/app/consultations/page.tsx
git commit -m "feat: add consultations page with 30s auto-refresh and status badges"
```

---

## Task 9: Express static serving + root build scripts

**Files:**
- Modify: `packages/api/src/app.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: Mount static middleware in `packages/api/src/app.ts`**

Add one import and one `app.use` call. Open `packages/api/src/app.ts` and make it look like this:

```typescript
import express from 'express'
import helmet from 'helmet'
import path from 'path'
import type { PrismaClient } from '@prisma/client'
import type { Server } from 'socket.io'
import { AuthService } from './services/AuthService'
import { ConsultationService } from './services/ConsultationService'
import { PrescriptionService } from './services/PrescriptionService'
import { UploadService } from './services/UploadService'
import { otpService } from './services/OtpService'
import { prisma as defaultPrisma } from './lib/prisma'
import { createAuthRouter } from './routes/auth'
import { createDoctorsRouter } from './routes/doctors'
import { createAdminRouter } from './routes/admin'
import { createConsultationsRouter } from './routes/consultations'
import { createPrescriptionsRouter } from './routes/prescriptions'
import { createFhirRouter }         from './routes/fhir'

interface AppDeps {
  authService?:         AuthService
  consultationService?: ConsultationService
  prescriptionService?: PrescriptionService
  uploadService?:       UploadService
  db?:                  PrismaClient
  io?:                  Server
}

export function createApp(deps?: AppDeps): { app: express.Express } {
  const app = express()

  // Admin panel static files (Next.js static export)
  // __dirname is packages/api/dist/ in production, so ../../../apps/admin/out reaches the root
  app.use('/admin', express.static(path.join(__dirname, '../../../apps/admin/out')))

  app.use(helmet())
  app.use(express.json({ limit: '10kb' }))

  const db                  = deps?.db                  ?? defaultPrisma
  const authService         = deps?.authService         ?? new AuthService(otpService, db)
  const consultationService = deps?.consultationService ?? new ConsultationService(db, deps?.io)
  const prescriptionService = deps?.prescriptionService ?? new PrescriptionService(db)
  const uploadService       = deps?.uploadService       ?? new UploadService()

  app.use('/api/auth',          createAuthRouter(authService))
  app.use('/api/doctors',       createDoctorsRouter(db))
  app.use('/api/admin',         createAdminRouter(db))
  app.use('/api/consultations', createConsultationsRouter(consultationService, uploadService))
  app.use('/api/prescriptions', createPrescriptionsRouter(prescriptionService))
  app.use('/fhir/R4',           createFhirRouter(db))
  app.get('/health', (_req, res) => res.json({ ok: true }))

  return { app }
}
```

`express.static` is placed before `helmet()` intentionally so helmet headers are not applied to static assets (not needed, slightly faster).

- [ ] **Step 2: Update root `package.json`**

Replace the `"scripts"` section in the root `package.json`:

```json
{
  "name": "medicoya",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:api":     "npm --workspace packages/api run dev",
    "test":        "npm --workspace packages/api run test",
    "build:admin": "npm --workspace apps/admin run build",
    "build:api":   "npm --workspace packages/api run build",
    "build":       "npm run build:admin && npm run build:api",
    "start":       "npm --workspace packages/api run start"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "packageManager": "npm@11.12.1"
}
```

- [ ] **Step 3: Run API tests**

```bash
npm test
```

Expected: 116 passed, 0 failed. The static middleware doesn't affect API tests (the `out/` directory won't exist in test but `express.static` silently serves nothing when the directory doesn't exist).

- [ ] **Step 4: Build the admin panel**

```bash
npm run build:admin
```

Expected: Next.js outputs to `apps/admin/out/`. Build completes with no TypeScript or linting errors. You should see files like `apps/admin/out/index.html`, `apps/admin/out/doctors/index.html`, `apps/admin/out/consultations/index.html`.

- [ ] **Step 5: Build the API**

```bash
npm run build:api
```

Expected: TypeScript compiles to `packages/api/dist/` with no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/app.ts package.json
git commit -m "feat: serve admin static panel from Express, add monorepo build scripts"
```

---

## Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: 116 passed, 0 failed.

- [ ] **Step 2: Run full build**

```bash
npm run build
```

Expected: admin builds first (`npm run build:admin`), then API TypeScript compiles (`npm run build:api`). Both complete without errors.

- [ ] **Step 3: Verify build output**

```bash
ls apps/admin/out/
ls apps/admin/out/doctors/
ls apps/admin/out/consultations/
```

Expected: each directory contains `index.html` (and related static assets).

- [ ] **Step 4: Smoke-test the server locally**

In one terminal:
```bash
# Start the API (compiled)
npm run start
```

In a browser, open: `http://localhost:3000/admin`

Expected: login page renders with "MédicoYa Admin" heading and phone input field. No console errors.

- [ ] **Step 5: Final commit if any fixes needed**

If any build errors were fixed in this task:
```bash
git add -p
git commit -m "fix: final build cleanup sub-proyecto 3b"
```

---

## Acceptance criteria recap

- [ ] Admin can log in with phone + OTP; non-admin users see "Acceso denegado"
- [ ] Pending doctors list shows with Approve and Reject buttons; both work
- [ ] Approved doctors list shows all doctors with `approved_at != null`
- [ ] Consultations page shows today's consultations with status badges; auto-refreshes every 30s
- [ ] Logout clears JWT and redirects to login
- [ ] Any `401` response clears JWT and redirects to login
- [ ] `npm run build` compiles both admin and API without errors
- [ ] `/admin` accessible in production at the Express server URL
