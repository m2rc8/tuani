# MédicoYa Sub-proyecto 1: Monorepo Scaffold + DB Schema + Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la infraestructura base del monorepo con npm workspaces, schema de PostgreSQL via Prisma, y autenticación OTP+JWT con stub de desarrollo.

**Architecture:** Monorepo npm workspaces con `apps/` y `packages/api/`. El backend Express usa capa de servicios (routes thin → services con lógica → lib para clientes externos). Auth usa el patrón Strategy: `OtpService` interface con `DevOtpService` (stub) y `TwilioOtpService` (producción). `createApp()` acepta inyección de dependencias para testabilidad.

**Tech Stack:** Node.js 20, TypeScript 5, Express 4, Prisma 5, PostgreSQL 15, Zod 3, JWT, libphonenumber-js, express-rate-limit, Vitest, Supertest.

---

## File Map

```
medicoYa/
├── package.json                          CREATE — npm workspaces root
├── tsconfig.base.json                    CREATE — TypeScript base config compartida
├── apps/
│   ├── mobile/.gitkeep                   CREATE — placeholder
│   └── admin/.gitkeep                    CREATE — placeholder
└── packages/
    └── api/
        ├── package.json                  CREATE — dependencias API
        ├── tsconfig.json                 CREATE — extends tsconfig.base
        ├── vitest.config.ts              CREATE — test runner config
        ├── .env.example                  CREATE — variables requeridas
        ├── prisma/
        │   └── schema.prisma             CREATE — User, Doctor, Patient
        └── src/
            ├── test-setup.ts             CREATE — env vars para tests
            ├── app.ts                    CREATE — Express app factory (inyectable)
            ├── server.ts                 CREATE — entry point (app.listen)
            ├── lib/
            │   ├── prisma.ts             CREATE — PrismaClient singleton
            │   └── twilio.ts             CREATE — Twilio client singleton
            ├── services/
            │   ├── OtpService.ts         CREATE — interface + DevOtpService + TwilioOtpService
            │   ├── OtpService.test.ts    CREATE — unit tests DevOtpService
            │   ├── AuthService.ts        CREATE — sendOtp + verifyOtpAndLogin
            │   └── AuthService.test.ts   CREATE — unit tests con mocks
            ├── middleware/
            │   ├── requireAuth.ts        CREATE — JWT verify middleware
            │   └── requireAuth.test.ts   CREATE — unit tests
            └── routes/
                ├── auth.ts               CREATE — POST /api/auth/send-otp + verify-otp
                └── auth.test.ts          CREATE — integration tests con supertest
```

---

## Prerequisito: PostgreSQL local

Necesitas PostgreSQL 15 corriendo localmente. Opción más rápida con Docker:

```bash
docker run --name medicoYa-pg \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=medicoya_dev \
  -p 5432:5432 \
  -d postgres:15
```

URL resultante: `postgresql://postgres:dev@localhost:5432/medicoya_dev`

---

## Task 1: Monorepo root scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `apps/mobile/.gitkeep`
- Create: `apps/admin/.gitkeep`

- [ ] **Step 1: Crear package.json raíz**

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
    "dev:api": "npm --workspace packages/api run dev",
    "test": "npm --workspace packages/api run test",
    "build": "npm --workspace packages/api run build"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 2: Crear tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Crear placeholders de apps**

```bash
mkdir -p apps/mobile apps/admin
echo "" > apps/mobile/.gitkeep
echo "" > apps/admin/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.base.json apps/
git commit -m "chore: monorepo root scaffold with npm workspaces"
```

---

## Task 2: API package scaffold

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/vitest.config.ts`
- Create: `packages/api/.env.example`

- [ ] **Step 1: Crear packages/api/package.json**

```json
{
  "name": "@medicoya/api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5",
    "express": "^4",
    "express-rate-limit": "^7",
    "helmet": "^7",
    "jsonwebtoken": "^9",
    "libphonenumber-js": "^1",
    "twilio": "^4",
    "zod": "^3"
  },
  "devDependencies": {
    "@types/express": "^4",
    "@types/jsonwebtoken": "^9",
    "@types/node": "^20",
    "@types/supertest": "^6",
    "prisma": "^5",
    "supertest": "^7",
    "tsx": "^4",
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: Crear packages/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Crear packages/api/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 4: Crear packages/api/.env.example**

```env
# Base de datos
DATABASE_URL=postgresql://postgres:dev@localhost:5432/medicoya_dev

# JWT — mínimo 32 caracteres
JWT_SECRET=cambia-esto-por-un-secreto-seguro-de-prod

# Twilio (solo requerido en NODE_ENV=production)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Entorno
NODE_ENV=development
PORT=3000
```

- [ ] **Step 5: Copiar .env.example a .env y configurar DATABASE_URL**

```bash
cp packages/api/.env.example packages/api/.env
# Editar packages/api/.env con DATABASE_URL real y JWT_SECRET
```

JWT_SECRET de ejemplo para dev:
```
JWT_SECRET=dev-secret-medicoya-min-32-chars-ok
```

- [ ] **Step 6: Instalar dependencias**

```bash
npm install
```

Resultado esperado: `packages/api/node_modules/` creado, `package-lock.json` actualizado.

- [ ] **Step 7: Commit**

```bash
git add packages/api/package.json packages/api/tsconfig.json packages/api/vitest.config.ts packages/api/.env.example package-lock.json
git commit -m "chore: API package scaffold with dependencies"
```

---

## Task 3: Prisma schema + primera migración

**Files:**
- Create: `packages/api/prisma/schema.prisma`

- [ ] **Step 1: Crear packages/api/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                 String    @id @default(uuid())
  phone              String    @unique
  name               String?
  role               Role
  preferred_language Language  @default(es)
  created_at         DateTime  @default(now())

  doctor   Doctor?
  patient  Patient?
}

enum Role {
  patient
  doctor
  admin
}

enum Language {
  es
  en
}

model Doctor {
  id           String    @id
  user         User      @relation(fields: [id], references: [id])
  cedula       String?   @unique
  cmh_verified Boolean   @default(false)
  available    Boolean   @default(false)
  bio          String?
  approved_at  DateTime?
}

model Patient {
  id                String           @id
  user              User             @relation(fields: [id], references: [id])
  dob               DateTime?
  allergies         String?
  registered_by     String?
  registration_mode RegistrationMode @default(self)
}

enum RegistrationMode {
  self
  brigade_doctor
}
```

- [ ] **Step 2: Ejecutar migración**

```bash
cd packages/api && npx prisma migrate dev --name init
```

Resultado esperado:
```
✔ Generated Prisma Client
✔ Your database is now in sync with your schema.
```

Tablas creadas: `users`, `doctors`, `patients` (Prisma pluraliza automáticamente).

- [ ] **Step 3: Generar Prisma Client**

```bash
npx prisma generate
```

- [ ] **Step 4: Verificar tablas en Prisma Studio (opcional)**

```bash
npx prisma studio
```

Abrir http://localhost:5555, verificar que aparecen las 3 tablas.

- [ ] **Step 5: Agregar .env a .gitignore**

Crear/actualizar `packages/api/.gitignore`:

```
.env
node_modules/
dist/
```

- [ ] **Step 6: Commit**

```bash
git add packages/api/prisma/ packages/api/.gitignore
git commit -m "feat: Prisma schema with User, Doctor, Patient models"
```

---

## Task 4: Prisma client singleton + test setup

**Files:**
- Create: `packages/api/src/lib/prisma.ts`
- Create: `packages/api/src/lib/twilio.ts`
- Create: `packages/api/src/test-setup.ts`

- [ ] **Step 1: Crear packages/api/src/lib/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 2: Crear packages/api/src/lib/twilio.ts**

```typescript
import twilio from 'twilio'

export const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID ?? ''

let _client: ReturnType<typeof twilio> | null = null

export function getTwilioClient() {
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )
  }
  return _client
}
```

Nota: lazy init evita que tests fallen por falta de credenciales Twilio.

- [ ] **Step 3: Crear packages/api/src/test-setup.ts**

```typescript
process.env.NODE_ENV = 'development'
process.env.JWT_SECRET = 'test-secret-medicoya-min-32-chars-ok'
```

- [ ] **Step 4: Verificar que TypeScript compila hasta aquí**

```bash
cd packages/api && npx tsc --noEmit
```

Resultado esperado: sin errores (solo warnings de archivos vacíos si los hay).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/
git commit -m "feat: Prisma singleton, Twilio client, test setup"
```

---

## Task 5: OtpService (TDD)

**Files:**
- Create: `packages/api/src/services/OtpService.ts`
- Create: `packages/api/src/services/OtpService.test.ts`

- [ ] **Step 1: Escribir tests fallidos**

Crear `packages/api/src/services/OtpService.test.ts`:

```typescript
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
```

- [ ] **Step 2: Ejecutar tests — verificar que fallan**

```bash
cd packages/api && npx vitest run src/services/OtpService.test.ts
```

Resultado esperado: FAIL — `Cannot find module './OtpService'`

- [ ] **Step 3: Implementar OtpService**

Crear `packages/api/src/services/OtpService.ts`:

```typescript
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
```

- [ ] **Step 4: Ejecutar tests — verificar que pasan**

```bash
cd packages/api && npx vitest run src/services/OtpService.test.ts
```

Resultado esperado: PASS — 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/
git commit -m "feat: OtpService interface with DevOtpService stub and TwilioOtpService"
```

---

## Task 6: AuthService (TDD)

**Files:**
- Create: `packages/api/src/services/AuthService.ts`
- Create: `packages/api/src/services/AuthService.test.ts`

- [ ] **Step 1: Escribir tests fallidos**

Crear `packages/api/src/services/AuthService.test.ts`:

```typescript
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
```

- [ ] **Step 2: Ejecutar tests — verificar que fallan**

```bash
cd packages/api && npx vitest run src/services/AuthService.test.ts
```

Resultado esperado: FAIL — `Cannot find module './AuthService'`

- [ ] **Step 3: Implementar AuthService**

Crear `packages/api/src/services/AuthService.ts`:

```typescript
import { PrismaClient, Language, Role } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { OtpService } from './OtpService'

export interface AuthUser {
  id: string
  role: Role
  name: string | null
  preferred_language: Language
}

export interface LoginResult {
  token: string
  user: AuthUser
}

export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly db: PrismaClient
  ) {}

  async sendOtp(phone: string): Promise<void> {
    await this.otp.sendOtp(phone)
  }

  async verifyOtpAndLogin(
    phone: string,
    code: string,
    lang?: Language
  ): Promise<LoginResult> {
    const valid = await this.otp.verifyOtp(phone, code)
    if (!valid) throw new Error('INVALID_CODE')

    const user = await this.db.user.upsert({
      where: { phone },
      update: lang ? { preferred_language: lang } : {},
      create: {
        phone,
        role: Role.patient,
        preferred_language: lang ?? Language.es,
      },
    })

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
        preferred_language: user.preferred_language,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    )

    return {
      token,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        preferred_language: user.preferred_language,
      },
    }
  }
}
```

- [ ] **Step 4: Ejecutar tests — verificar que pasan**

```bash
cd packages/api && npx vitest run src/services/AuthService.test.ts
```

Resultado esperado: PASS — 6 tests passed

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/
git commit -m "feat: AuthService with OTP verification and JWT generation"
```

---

## Task 7: requireAuth middleware (TDD)

**Files:**
- Create: `packages/api/src/middleware/requireAuth.ts`
- Create: `packages/api/src/middleware/requireAuth.test.ts`

- [ ] **Step 1: Escribir tests fallidos**

Crear `packages/api/src/middleware/requireAuth.test.ts`:

```typescript
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
```

- [ ] **Step 2: Ejecutar tests — verificar que fallan**

```bash
cd packages/api && npx vitest run src/middleware/requireAuth.test.ts
```

Resultado esperado: FAIL — `Cannot find module './requireAuth'`

- [ ] **Step 3: Implementar requireAuth**

Crear `packages/api/src/middleware/requireAuth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Language, Role } from '@prisma/client'

export interface JwtPayload {
  sub: string
  role: Role
  preferred_language: Language
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

- [ ] **Step 4: Ejecutar tests — verificar que pasan**

```bash
cd packages/api && npx vitest run src/middleware/requireAuth.test.ts
```

Resultado esperado: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/middleware/
git commit -m "feat: requireAuth JWT middleware"
```

---

## Task 8: Auth routes + Express app (TDD integration)

**Files:**
- Create: `packages/api/src/routes/auth.ts`
- Create: `packages/api/src/routes/auth.test.ts`
- Create: `packages/api/src/app.ts`
- Create: `packages/api/src/server.ts`

- [ ] **Step 1: Crear Express app factory**

Crear `packages/api/src/app.ts`:

```typescript
import express from 'express'
import helmet from 'helmet'
import { AuthService } from './services/AuthService'
import { otpService } from './services/OtpService'
import { prisma } from './lib/prisma'
import { createAuthRouter } from './routes/auth'

interface AppDeps {
  authService?: AuthService
}

export function createApp(deps?: AppDeps): express.Express {
  const app = express()

  app.use(helmet())
  app.use(express.json())

  const authService =
    deps?.authService ?? new AuthService(otpService, prisma)

  app.use('/api/auth', createAuthRouter(authService))
  app.get('/health', (_req, res) => res.json({ ok: true }))

  return app
}
```

- [ ] **Step 2: Crear entry point**

Crear `packages/api/src/server.ts`:

```typescript
import 'dotenv/config'
import { createApp } from './app'

const PORT = process.env.PORT ?? 3000
const app = createApp()

app.listen(PORT, () => {
  console.log(`MédicoYa API running on port ${PORT}`)
})
```

Nota: necesita `dotenv` para cargar `.env` en producción. Instalar:

```bash
cd packages/api && npm install dotenv
```

- [ ] **Step 3: Escribir tests de integración fallidos**

Crear `packages/api/src/routes/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { AuthService } from '../services/AuthService'
import { DevOtpService } from '../services/OtpService'
import { Language, Role } from '@prisma/client'

// Prisma mock — evita necesitar BD real en tests de integración
const mockUser = {
  id: 'user-uuid-1',
  phone: '',
  name: null,
  role: Role.patient,
  preferred_language: Language.es,
  created_at: new Date(),
}

const mockPrisma = {
  user: {
    upsert: vi.fn().mockImplementation(({ where }) => {
      return Promise.resolve({ ...mockUser, phone: where.phone })
    }),
  },
}

function makeTestApp() {
  const otp = new DevOtpService()
  const authService = new AuthService(otp, mockPrisma as any)
  return { app: createApp({ authService }), otp }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/send-otp', () => {
  it('returns 200 for valid Honduras phone', async () => {
    const { app } = makeTestApp()
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '+50499000000' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 400 for invalid phone format', async () => {
    const { app } = makeTestApp()
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: 'not-a-phone' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when phone is missing', async () => {
    const { app } = makeTestApp()
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({})
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/verify-otp', () => {
  it('returns 200 with token for correct code', async () => {
    const { app } = makeTestApp()
    await request(app).post('/api/auth/send-otp').send({ phone: '+50499000001' })
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+50499000001', code: '123456' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.role).toBe('patient')
  })

  it('returns 401 for wrong code', async () => {
    const { app } = makeTestApp()
    await request(app).post('/api/auth/send-otp').send({ phone: '+50499000002' })
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+50499000002', code: '000000' })
    expect(res.status).toBe(401)
  })

  it('returns 401 for code not yet requested', async () => {
    const { app } = makeTestApp()
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+50499000003', code: '123456' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for code shorter than 6 digits', async () => {
    const { app } = makeTestApp()
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+50499000004', code: '123' })
    expect(res.status).toBe(400)
  })

  it('sets preferred_language from Accept-Language header', async () => {
    const { app } = makeTestApp()
    await request(app).post('/api/auth/send-otp').send({ phone: '+50499000005' })
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .set('Accept-Language', 'en-US')
      .send({ phone: '+50499000005', code: '123456' })
    expect(res.status).toBe(200)
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { preferred_language: Language.en },
      })
    )
  })
})

describe('GET /health', () => {
  it('returns ok', async () => {
    const { app } = makeTestApp()
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
```

- [ ] **Step 4: Ejecutar tests — verificar que fallan**

```bash
cd packages/api && npx vitest run src/routes/auth.test.ts
```

Resultado esperado: FAIL — `Cannot find module '../routes/auth'`

- [ ] **Step 5: Implementar auth routes**

Crear `packages/api/src/routes/auth.ts`:

```typescript
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

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { error: 'Too many OTP requests, try again in 10 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
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
```

- [ ] **Step 6: Ejecutar tests — verificar que pasan**

```bash
cd packages/api && npx vitest run src/routes/auth.test.ts
```

Resultado esperado: PASS — 8 tests passed

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/
git commit -m "feat: auth routes with OTP endpoints and Express app factory"
```

---

## Task 9: Verificación final completa

- [ ] **Step 1: Ejecutar suite completa de tests**

```bash
cd packages/api && npx vitest run
```

Resultado esperado:
```
✓ src/services/OtpService.test.ts (4 tests)
✓ src/services/AuthService.test.ts (6 tests)
✓ src/middleware/requireAuth.test.ts (5 tests)
✓ src/routes/auth.test.ts (8 tests)

Test Files  4 passed
Tests       23 passed
```

- [ ] **Step 2: Verificar TypeScript sin errores**

```bash
cd packages/api && npx tsc --noEmit
```

Resultado esperado: sin output (exit code 0).

- [ ] **Step 3: Smoke test manual con servidor corriendo**

```bash
cd packages/api && npm run dev
```

En otra terminal:

```bash
# Health check
curl http://localhost:3000/health
# Esperado: {"ok":true}

# Enviar OTP (DEV)
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+50499000000"}'
# Esperado: {"ok":true}

# Verificar OTP correcto (DEV)
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -H "Accept-Language: es-HN" \
  -d '{"phone": "+50499000000", "code": "123456"}'
# Esperado: {"token":"eyJ...","user":{"id":"...","role":"patient",...}}

# Verificar OTP incorrecto
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+50499000000", "code": "000000"}'
# Esperado: HTTP 401 {"error":"Invalid or expired code"}

# Rate limit — ejecutar 4 veces send-otp rápido
for i in 1 2 3 4; do
  curl -X POST http://localhost:3000/api/auth/send-otp \
    -H "Content-Type: application/json" \
    -d '{"phone": "+50499111111"}'
done
# El 4to debe retornar HTTP 429
```

- [ ] **Step 4: Verificar migración de BD (acceptance criteria)**

```bash
cd packages/api && npx prisma migrate dev
```

Resultado esperado: `Already in sync`

Verificar tablas en psql:

```bash
psql postgresql://postgres:dev@localhost:5432/medicoya_dev -c "\dt"
```

Resultado esperado:
```
 Schema |       Name       | Type  |  Owner
--------+------------------+-------+----------
 public | _prisma_migrations | table | postgres
 public | doctors          | table | postgres
 public | patients         | table | postgres
 public | users            | table | postgres
```

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: sub-project 1 complete — scaffold, DB schema, OTP+JWT auth"
```

---

## Checklist de acceptance criteria (del spec)

- [ ] `npm install` en raíz instala workspaces sin errores
- [ ] `prisma migrate dev` crea tablas `users`, `doctors`, `patients`
- [ ] `POST /api/auth/send-otp` con teléfono válido → 200 en DEV
- [ ] `POST /api/auth/verify-otp` con `123456` → JWT válido en DEV
- [ ] `POST /api/auth/verify-otp` con código incorrecto → 401
- [ ] 4to intento de OTP en 10 min → 429
- [ ] `requireAuth` rechaza request sin token → 401
- [ ] `requireAuth` agrega `req.user` con `{ sub, role, preferred_language }` en request válido
- [ ] `tsc --noEmit` sin errores

---

## Siguientes pasos

**Sub-proyecto 2** (depende de este): Backend API — consultas, chat Socket.io, recetas QR, subida de fotos.
Spec: `docs/superpowers/specs/` (pendiente de crear).
