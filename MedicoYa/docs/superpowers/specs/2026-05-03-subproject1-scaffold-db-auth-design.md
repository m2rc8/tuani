# MédicoYa — Sub-proyecto 1: Monorepo Scaffold + DB Schema + Auth

**Fecha:** 2026-05-03  
**Estado:** Aprobado  
**Fase PRD:** Fase 1 MVP  
**Scope:** Infraestructura base — monorepo, base de datos, autenticación OTP + JWT

---

## Decisiones técnicas

| Decisión | Elección | Razón |
|----------|----------|-------|
| Lenguaje | TypeScript | Tipos para DB, API y app desde día 1 |
| Monorepo tooling | npm workspaces (carpetas simples) | Equipo 1–3 devs, MVP — sin overhead de Turborepo |
| ORM | Prisma | Types auto-generados del schema, migraciones integradas |
| Auth | Twilio Verify API v2 + JWT 7 días | Estándar de industria, OTP sin contraseñas |
| Auth en dev | OTP stub `123456` | Desarrollo sin costo ni bloqueo de credenciales |
| Arquitectura backend | Capa de servicios (Enfoque B) | Routes thin, lógica en services, extensible a Fase 2 |

---

## Estructura del monorepo

```
medicoYa/
├── apps/
│   ├── mobile/              # React Native + Expo (paciente + médico) — Sub-proyecto 3/4
│   └── admin/               # Panel web — Sub-proyecto 5
├── packages/
│   └── api/                 # Node.js + Express + Prisma
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       ├── src/
│       │   ├── routes/
│       │   │   └── auth.ts
│       │   ├── services/
│       │   │   ├── OtpService.ts        # Interface + DevOtpService + TwilioOtpService
│       │   │   └── AuthService.ts
│       │   ├── middleware/
│       │   │   └── requireAuth.ts       # Verifica JWT, agrega req.user
│       │   ├── lib/
│       │   │   ├── prisma.ts            # Singleton PrismaClient
│       │   │   └── twilio.ts            # Cliente Twilio (solo instanciado en PROD)
│       │   └── server.ts
│       ├── package.json
│       └── tsconfig.json
├── package.json             # npm workspaces root
└── tsconfig.base.json
```

---

## Prisma Schema (DB)

Tablas incluidas en este sub-proyecto: `User`, `Doctor`, `Patient`.  
Tablas diferidas a Sub-proyecto 2: `Consultation`, `Message`, `Prescription`, `Brigade`.

**Gap fix integrado:** columna `preferred_language` en `User` — requerida para SMS OTP y push notifications en el idioma correcto del usuario (no estaba en el PRD original).

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
  // messages Message[] — se agrega en Sub-proyecto 2 cuando Message model exista
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
  // consultations Consultation[] — se agrega en Sub-proyecto 2
}

model Patient {
  id                String            @id
  user              User              @relation(fields: [id], references: [id])
  dob               DateTime?
  allergies         String?
  registered_by     String?
  registration_mode RegistrationMode  @default(self)
  // consultations Consultation[] — se agrega en Sub-proyecto 2
}

enum RegistrationMode {
  self
  brigade_doctor
}
```

> `Consultation`, `Message`, `Prescription` se agregan en Sub-proyecto 2 como modelos adicionales en el mismo schema.

---

## Auth: OTP + JWT

### Endpoints

```
POST /api/auth/send-otp
POST /api/auth/verify-otp
```

### Flujo completo

```
POST /api/auth/send-otp { phone: "+50499123456" }
  1. libphonenumber-js: validar formato E.164
  2. express-rate-limit: 3 requests / 10 min / IP
  3. DEV (NODE_ENV=development): almacenar { phone → "123456" } en Map en memoria
  4. PROD: Twilio Verify API v2 → send({ to: phone, channel: "sms" })
  → 200 OK | 429 Too Many Requests | 400 Invalid phone

POST /api/auth/verify-otp { phone: "+50499123456", code: "123456" }
  1. DEV: comparar con Map en memoria
  2. PROD: Twilio Verify API v2 → check({ to: phone, code })
  3. Si válido: prisma.user.upsert({ where: { phone }, ... })
  4. Firmar JWT: { sub: user.id, role, preferred_language } — expira 7 días
  5. Si header Accept-Language presente y distinto al guardado → actualizar preferred_language en DB
     (solo en verify-otp/login, no en cada request autenticado)
  → 200 { token, user: { id, role, name, preferred_language } }
     | 401 Invalid code | 400 Expired
```

### Arquitectura de servicios

```typescript
// OtpService.ts
interface OtpService {
  sendOtp(phone: string): Promise<void>
  verifyOtp(phone: string, code: string): Promise<boolean>
}

class DevOtpService implements OtpService {
  private codes = new Map<string, string>()
  async sendOtp(phone: string) { this.codes.set(phone, '123456') }
  async verifyOtp(phone: string, code: string) { return this.codes.get(phone) === code }
}

class TwilioOtpService implements OtpService {
  async sendOtp(phone: string) { /* twilio.verify.v2.services(SID).verifications.create */ }
  async verifyOtp(phone: string, code: string) { /* .verificationChecks.create */ }
}

// Selección por entorno en lib/twilio.ts o server.ts
export const otpService: OtpService =
  process.env.NODE_ENV === 'development' ? new DevOtpService() : new TwilioOtpService()
```

```typescript
// AuthService.ts
class AuthService {
  constructor(private otp: OtpService, private db: PrismaClient) {}

  async sendOtp(phone: string): Promise<void>
  async verifyOtpAndLogin(phone: string, code: string, lang?: Language): Promise<{
    token: string
    user: Pick<User, 'id' | 'role' | 'name' | 'preferred_language'>
  }>
}
```

```typescript
// middleware/requireAuth.ts
// Lee Authorization: Bearer <token>
// Verifica JWT → agrega req.user = { id, role, preferred_language }
// 401 si token inválido o expirado
```

### Seguridad

| Medida | Detalle |
|--------|---------|
| Rate limiting | `express-rate-limit`: 3 OTP sends / 10 min / IP |
| JWT | Expira 7 días, firmado con `JWT_SECRET` env var |
| Validación de teléfono | `libphonenumber-js` E.164 antes de llamar Twilio |
| Headers HTTP | `helmet` en todas las respuestas |
| OTP window PROD | Twilio Verify maneja ventana de 10 min automáticamente |
| Datos en tránsito | HTTPS obligatorio (Railway.app lo provee) |

---

## Variables de entorno requeridas

```env
# Base de datos
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=...

# Twilio (solo en PROD/staging)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=...

# Entorno
NODE_ENV=development|production
PORT=3000
```

---

## Dependencias (packages/api)

```json
{
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
    "prisma": "^5",
    "tsx": "^4",
    "typescript": "^5"
  }
}
```

---

## Criterios de aceptación (Definition of Done)

- [ ] `npm install` en raíz instala workspaces sin errores
- [ ] `prisma migrate dev` crea tablas `users`, `doctors`, `patients` en PostgreSQL local
- [ ] `POST /api/auth/send-otp` con teléfono válido retorna 200 en DEV
- [ ] `POST /api/auth/verify-otp` con código `123456` retorna JWT válido en DEV
- [ ] `POST /api/auth/verify-otp` con código incorrecto retorna 401
- [ ] 4to intento de OTP en 10 min retorna 429
- [ ] `requireAuth` middleware rechaza request sin token con 401
- [ ] `requireAuth` middleware agrega `req.user` con `{ id, role, preferred_language }` en request válido
- [ ] TypeScript compila sin errores (`tsc --noEmit`)

---

## Lo que NO incluye este sub-proyecto

- Endpoints de consultas, mensajes, recetas (Sub-proyecto 2)
- App móvil (Sub-proyectos 3 y 4)
- Admin panel (Sub-proyecto 5)
- Tablas de brigadas (Sub-proyecto 2, Fase 2)
- Videollamada, pagos Tigo Money (Fase 2+)

---

## Sub-proyectos siguientes

| # | Scope | Depende de |
|---|-------|------------|
| 2 | Backend API: consultas, chat Socket.io, recetas QR, fotos | Sub-proyecto 1 |
| 3 | App móvil paciente (Expo) | Sub-proyecto 2 |
| 4 | App móvil médico (Expo) | Sub-proyecto 2 |
| 5 | Admin panel | Sub-proyecto 2 |
