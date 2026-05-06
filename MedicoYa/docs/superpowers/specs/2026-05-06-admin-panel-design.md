# Admin Panel — Design Spec

**Date:** 2026-05-06
**Project:** MédicoYa
**Scope:** Phase 1 admin web panel — doctor verification + daily consultation view.

---

## 1. Decisions

| Question | Decision |
|----------|----------|
| Tech | React + Vite SPA in `apps/admin/` |
| Auth | OTP reuse — same `POST /api/auth/send-otp` + `POST /api/auth/verify-otp` as mobile; JWT stored in `localStorage`; block if `user.role !== 'admin'` |
| Serving | Express already serves `apps/admin/out` at `/admin`; add SPA fallback `GET /admin/*` → `index.html` |
| Styling | Plain CSS — no Tailwind, no UI library |
| API | All admin endpoints already exist — no backend changes except SPA fallback |

---

## 2. Architecture

```
apps/admin/
  index.html
  vite.config.ts          base: '/admin', outDir: 'out'
  src/
    main.tsx
    App.tsx               React Router v6 — routes + PrivateRoute wrapper
    lib/
      api.ts              axios instance; reads token from localStorage; sets Authorization header
    pages/
      LoginPage.tsx
      PendingDoctorsPage.tsx
      ApprovedDoctorsPage.tsx
      ConsultationsPage.tsx
    components/
      NavBar.tsx
```

**`packages/api/src/app.ts` change:** Add SPA fallback after static serve and after API routes:

```typescript
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../../apps/admin/out/index.html'))
})
```

---

## 3. Auth Flow

1. `LoginPage` — two-step form: phone input → `POST /api/auth/send-otp` → OTP input → `POST /api/auth/verify-otp`
2. Response: `{ token, user: { id, role, name } }`
3. If `user.role !== 'admin'`: show "Acceso denegado. Esta cuenta no tiene permisos de administrador." — do NOT store token.
4. On success: store `token` and `userName` in `localStorage`; redirect to `/admin/doctors/pending`
5. `PrivateRoute` wrapper: if no token in `localStorage`, redirect to `/admin/login`
6. Logout: clear `localStorage`, redirect to `/admin/login`

---

## 4. Pages

### 4.1 LoginPage (`/admin/login`)

- Step 1: phone `<input>` + "Enviar código" button → calls `POST /api/auth/send-otp`
- Step 2 (after OTP sent): 6-digit code `<input>` + "Verificar" button → calls `POST /api/auth/verify-otp`
- Error states: "Código inválido o expirado", "Número de teléfono inválido"
- Loading state on both buttons while request in flight
- Redirects to `/admin/doctors/pending` on success

### 4.2 PendingDoctorsPage (`/admin/doctors/pending`)

- Fetches `GET /api/admin/doctors/pending` on mount
- Table columns: Nombre, Teléfono, Cédula, CMH Verificado, Acciones
- CMH Verificado: "Sí" / "No" badge
- Acciones: "Aprobar" button → `PUT /api/admin/doctors/:id/approve` → removes row optimistically
- Acciones: "Rechazar" button → `PUT /api/admin/doctors/:id/reject` → removes row optimistically
- Empty state: "No hay médicos pendientes de verificación."
- Loading: spinner while fetching

### 4.3 ApprovedDoctorsPage (`/admin/doctors/approved`)

- Fetches `GET /api/admin/doctors/approved` on mount
- Table columns: Nombre, Teléfono, Cédula, Aprobado el
- "Aprobado el": formatted date string
- Empty state: "No hay médicos aprobados todavía."
- Read-only — no actions

### 4.4 ConsultationsPage (`/admin/consultations`)

- Date `<input type="date">` defaulting to today in `YYYY-MM-DD` format
- Fetches `GET /api/admin/consultations?date=YYYY-MM-DD` on mount and on date change
- Table columns: Hora, Paciente, Médico, Estado
- Hora: `created_at` formatted as `HH:MM`
- Estado: colored badge (pending=#F59E0B, active=#3B82F6, completed=#22C55E, rejected=#EF4444)
- Empty state: "No hay consultas para esta fecha."

---

## 5. NavBar

Shown on all authenticated pages. Contains:
- "MédicoYa Admin" title (left)
- Links: "Médicos pendientes" | "Médicos aprobados" | "Consultas" (center)
- "Cerrar sesión" button (right) — clears localStorage, redirects to `/admin/login`

Active link highlighted with underline/bold.

---

## 6. API Client (`src/lib/api.ts`)

```typescript
import axios from 'axios'

const api = axios.create({ baseURL: '/' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUserName')
      window.location.href = '/admin/login'
    }
    return Promise.reject(err)
  }
)

export default api
```

---

## 7. Vite Config

```typescript
// apps/admin/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/admin',
  build: { outDir: 'out', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
```

Dev proxy routes `/api` to the local Express server — no CORS issues in development.

---

## 8. Root package.json script

Add to root `package.json`:

```json
"build:admin": "cd apps/admin && npm run build"
```

---

## 9. Files Changed

| Action | File |
|--------|------|
| NEW | `apps/admin/index.html` |
| NEW | `apps/admin/vite.config.ts` |
| NEW | `apps/admin/package.json` |
| NEW | `apps/admin/src/main.tsx` |
| NEW | `apps/admin/src/App.tsx` |
| NEW | `apps/admin/src/lib/api.ts` |
| NEW | `apps/admin/src/pages/LoginPage.tsx` |
| NEW | `apps/admin/src/pages/PendingDoctorsPage.tsx` |
| NEW | `apps/admin/src/pages/ApprovedDoctorsPage.tsx` |
| NEW | `apps/admin/src/pages/ConsultationsPage.tsx` |
| NEW | `apps/admin/src/components/NavBar.tsx` |
| MOD | `packages/api/src/app.ts` |
| MOD | `package.json` (root) |

---

## 10. Out of Scope

- Doctor profile editing (name, bio, cédula)
- Manual payment confirmation UI
- Real-time updates (page reload required for new data)
- Pagination (Phase 1 volume is small)
- i18n (admin panel is internal — Spanish only)
