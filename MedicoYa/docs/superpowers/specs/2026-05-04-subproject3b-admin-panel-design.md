# MédicoYa — Sub-proyecto 3b: Panel de Administración

**Fecha:** 2026-05-04
**Estado:** Aprobado
**Fase PRD:** Fase 1 MVP
**Scope:** Panel web de administración — aprobación de médicos, monitoreo de consultas del día

---

## Decisiones técnicas

| Decisión | Elección | Razón |
|----------|----------|-------|
| Framework | Next.js 14 (App Router) | Encaja en monorepo `apps/admin/`, TypeScript, estático exportable |
| Output | `output: 'export'` + `basePath: '/admin'` | Archivos estáticos servidos por Express existente, sin costo adicional en Railway |
| Styling | Tailwind CSS | Mínimo de dependencias, utilidades suficientes para 3 pantallas |
| Data fetching | React Query (`@tanstack/react-query`) | Auto-refetch 30s en consultas, `invalidateQueries` tras mutaciones, sin boilerplate de loading/error manual |
| Auth | OTP + JWT (reusa endpoints existentes del API) | Sin sistema de auth separado; JWT con `role: admin` guardado en `localStorage` |
| Navegación | Sidebar izquierdo fijo | Escala a más secciones en Fase 2; patrón estándar de dashboards de administración |
| Deployment | Express sirve `apps/admin/out/` como archivos estáticos en `/admin` | Sin servicio adicional en Railway (~$0 extra/mes) |

---

## Estructura de archivos

```
apps/admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← Shell: sidebar + auth guard (redirect a / si no hay JWT)
│   │   ├── page.tsx                ← Login: flujo phone → OTP en dos pasos
│   │   ├── doctors/
│   │   │   └── page.tsx            ← Tabs: Pendientes / Activos
│   │   └── consultations/
│   │       └── page.tsx            ← Tabla consultas de hoy, auto-refetch 30s
│   ├── components/
│   │   ├── Sidebar.tsx             ← Nav links + logout
│   │   ├── OtpForm.tsx             ← Phone input → OTP input, dos pasos en un componente
│   │   ├── DoctorsTable.tsx        ← Tabla con botones Aprobar/Rechazar inline
│   │   └── ConsultationsTable.tsx  ← Tabla con status badges coloreados
│   ├── lib/
│   │   ├── api.ts                  ← fetch wrapper: inyecta Bearer token, maneja 401 → logout
│   │   └── auth.ts                 ← localStorage helpers: getToken / setToken / clearToken
│   └── providers.tsx               ← ReactQueryProvider wrapping {children}
├── next.config.ts                  ← output: 'export', basePath: '/admin'
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Pantallas

### Login (`/admin`)

- Paso 1: campo de teléfono → `POST /api/auth/otp/request` → muestra paso 2
- Paso 2: campo OTP → `POST /api/auth/otp/verify` → guarda JWT en `localStorage` → redirige a `/admin/doctors`
- Si JWT existe y válido al cargar → redirige directo a `/admin/doctors`
- Error de OTP → mensaje inline, no recarga

### Médicos (`/admin/doctors`)

Dos tabs: **Pendientes** | **Activos**

**Pendientes:**
- `useQuery` → `GET /api/admin/doctors/pending`
- Por cada médico: nombre, cédula, fecha de registro
- Botón **Aprobar** → `useMutation` → `PUT /api/admin/doctors/:id/approve` → `invalidateQueries`
- Botón **Rechazar** → `useMutation` → `PUT /api/admin/doctors/:id/reject` → `invalidateQueries`
- Estado vacío: "No hay médicos pendientes"

**Activos:**
- `useQuery` → `GET /api/admin/doctors/approved` (endpoint nuevo, ver abajo)
- Por cada médico: nombre, cédula, estado disponible/no disponible (badge)
- Sin acciones (solo lectura en MVP)

### Consultas hoy (`/admin/consultations`)

- `useQuery` con `refetchInterval: 30_000` → `GET /api/admin/consultations?date=YYYY-MM-DD` (fecha de hoy)
- Columnas: paciente, médico asignado, estado (badge coloreado), hora de creación
- Status badges: `pending` → azul, `active` → amarillo, `completed` → verde, `cancelled`/`rejected` → rojo
- Indicador "↻ actualizado hace Ns" junto al título

---

## Cambios al API (`packages/api/`)

Tres endpoints nuevos en `src/routes/admin.ts`:

### `GET /api/admin/doctors/approved`

Devuelve todos los médicos con `approved_at != null` (independientemente de disponibilidad).

**Requiere:** `requireAuth` + `requireRole(Role.admin)`

**Respuesta:** array de doctors con `include: { user: { select: { name, phone } } }`, incluyendo campo `available`.

---

### `PUT /api/admin/doctors/:id/reject`

Marca un médico como rechazado. Guarda `rejected_at` en el modelo `Doctor`.

**Requiere:** `requireAuth` + `requireRole(Role.admin)`

**Respuesta:** `200` con el doctor actualizado, `404` si no existe.

**Cambio de schema necesario:** añadir campo `rejected_at DateTime?` a `Doctor` en `schema.prisma` + migración.

**Nota:** el rechazo es terminal en MVP — el médico no puede ser re-aprobado sin intervención directa en la base de datos. Un médico rechazado no aparece en la lista de pendientes ni de activos.

### `GET /api/admin/consultations?date=YYYY-MM-DD`

Devuelve todas las consultas de una fecha dada (basado en `created_at`).

**Requiere:** `requireAuth` + `requireRole(Role.admin)`

**Parámetro:** `date` query string en formato `YYYY-MM-DD`. Si ausente, usa la fecha de hoy (UTC).

**Respuesta:** array de consultas con `include: { patient: { include: { user: true } }, doctor: { include: { user: true } } }`.

---

## Integración con Express (servir estáticos)

En `packages/api/src/app.ts`, añadir antes de los demás `app.use`:

```typescript
import path from 'path'
// Serve Next.js static export — each route has its own index.html
app.use('/admin', express.static(path.join(__dirname, '../../../apps/admin/out')))
```

No se necesita catch-all SPA: `output: 'export'` genera un `index.html` por ruta (`/admin/doctors/index.html`, etc.), que `express.static` sirve directamente.

---

## Build y deployment

### Scripts en `package.json` raíz

```json
{
  "scripts": {
    "build:admin": "npm --workspace apps/admin run build",
    "build:api":   "npm --workspace packages/api run build",
    "build":       "npm run build:admin && npm run build:api",
    "start":       "npm --workspace packages/api run start"
  }
}
```

### Railway

`railway.toml` (o configuración en dashboard):

```toml
[build]
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run start"
```

---

## Auth guard

`apps/admin/src/app/layout.tsx` implementa el guard:

```typescript
'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getToken } from '../lib/auth'
import Providers from '../providers'

export default function RootLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const token = getToken()
    if (!token && pathname !== '/') router.replace('/')
    if (token && pathname === '/') router.replace('/doctors')
  }, [pathname])

  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

El `api.ts` wrapper intercepta `401` → llama `clearToken()` → `router.replace('/')`.

---

## Criterios de aceptación

- [ ] Admin puede iniciar sesión con teléfono + OTP y queda autenticado
- [ ] Admin ve lista de médicos pendientes con botones Aprobar/Rechazar funcionales
- [ ] Admin ve lista de médicos activos
- [ ] Admin ve consultas del día con estados actualizados cada 30s
- [ ] Logout limpia JWT y redirige a login
- [ ] `401` en cualquier llamada API → logout automático
- [ ] `npm run build` en raíz compila admin + API sin errores
- [ ] Panel accesible en `<dominio>/admin` en producción
