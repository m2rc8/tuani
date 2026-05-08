# Brigade Coordinator Dashboard — Design Spec

**Date:** 2026-05-08
**Project:** MédicoYa
**Scope:** Sub-project 3 of 3 — Coordinator web dashboard in `apps/admin`. API Brigade endpoints (Sub-project 1) and Mobile Brigade UI (Sub-project 2) are already implemented.

---

## 1. Decisions

| Question | Decision |
|----------|----------|
| App target | `apps/admin` — Next.js 14 App Router, Tailwind, `@tanstack/react-query` |
| Navigation | Role-aware shared shell — same login, different sidebar per role |
| Role storage | Store role in localStorage alongside token (add `getRole/setRole/clearRole` to `auth.ts`) |
| Coordinator redirect | After OTP verify with `coordinator` role → `/brigades`; layout redirect also role-aware |
| Pages | `/brigades` (list + create form) and `/brigades/[id]` (Dashboard tab + Reporte tab) |
| Data pattern | Follow existing pattern: inline `useQuery`/`useMutation` in `'use client'` components, `apiFetch` utility |
| Frontend tests | No Vitest setup in `apps/admin` — API tests only |
| API additions | One new endpoint: `GET /api/brigades/mine` (coordinator). Dashboard + report routes already exist. |

---

## 2. Codebase Context

### Admin app structure

```
apps/admin/src/
  app/
    layout.tsx          ← auth guard + sidebar shell (currently redirects all token holders to /doctors)
    page.tsx            ← login page with OtpForm
    doctors/page.tsx    ← admin-only
    consultations/page.tsx ← admin-only
  components/
    OtpForm.tsx         ← currently blocks non-admin roles
    Sidebar.tsx         ← static NAV list (Médicos, Consultas)
  lib/
    auth.ts             ← getToken/setToken/clearToken (localStorage)
    api.ts              ← apiFetch utility
  providers.tsx         ← QueryClientProvider
```

### Existing API routes in `packages/api/src/routes/brigades.ts`

Already implemented and in-scope for coordinator:
- `POST /api/brigades` — create brigade, requires `coordinator` role
- `GET /api/brigades/:id/dashboard` — requires `requireBrigadeOwner` middleware (checks `brigade.organizer_id === req.user.sub`)
- `GET /api/brigades/:id/report` — same middleware

Returns from `BrigadeService.getDashboard()`:
```typescript
{ total: number; attended: number; waiting: number; active_doctors: number }
```

Returns from `BrigadeService.getReport()`:
```typescript
{
  patient_count: number
  by_registration_mode: { self: number; brigade_doctor: number }
  top_diagnoses: { diagnosis: string; count: number }[]
}
```

**Missing:** `GET /api/brigades/mine` — lists brigades where `organizer_id = caller` (coordinator). Currently `GET /api/brigades` is doctor-only (lists by `BrigadeDoctor` membership).

---

## 3. Auth Changes

### `apps/admin/src/lib/auth.ts`

Add role storage alongside token:

```typescript
const ROLE_KEY = 'medicoya_admin_role'

export function getRole(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ROLE_KEY)
}

export function setRole(role: string): void {
  localStorage.setItem(ROLE_KEY, role)
}

export function clearRole(): void {
  localStorage.removeItem(ROLE_KEY)
}
```

Update `clearToken` to also clear role:
```typescript
export function clearToken(): void {
  localStorage.removeItem(KEY)
  localStorage.removeItem(ROLE_KEY)
}
```

### `apps/admin/src/components/OtpForm.tsx`

Change `verifyOtp` to accept both `admin` and `coordinator`:

```typescript
// before:
if (body.user?.role !== 'admin') {
  setError('Acceso denegado. Solo administradores.')
  return
}
setToken(body.token)
router.replace('/doctors')

// after:
const role = body.user?.role
if (role !== 'admin' && role !== 'coordinator') {
  setError('Acceso denegado.')
  return
}
setToken(body.token)
setRole(role)
router.replace(role === 'coordinator' ? '/brigades' : '/doctors')
```

### `apps/admin/src/app/layout.tsx`

Change hardcoded `/doctors` redirect to role-aware:

```typescript
// before:
if (token && pathname === '/') router.replace('/doctors')

// after:
if (token && pathname === '/') {
  const role = getRole()
  router.replace(role === 'coordinator' ? '/brigades' : '/doctors')
}
```

Import `getRole` alongside `getToken`.

---

## 4. Sidebar — Role-Aware NAV

### `apps/admin/src/components/Sidebar.tsx`

Replace static `NAV` array with role-derived nav:

```typescript
const role = getRole()

const NAV = role === 'coordinator'
  ? [{ href: '/brigades', label: '🚑 Brigadas' }]
  : [
      { href: '/doctors',       label: 'Médicos' },
      { href: '/consultations', label: 'Consultas' },
    ]
```

Import `getRole` from `../lib/auth`.

---

## 5. API Addition

### `GET /api/brigades/mine`

New endpoint in `packages/api/src/routes/brigades.ts`. Must be registered BEFORE `GET /:id`.

```typescript
router.get(
  '/mine',
  requireAuth,
  requireRole(Role.coordinator),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const brigades = await service.getMyBrigadesCoordinator(req.user!.sub)
      res.json(brigades)
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)
```

### `BrigadeService.getMyBrigadesCoordinator(organizerId: string)`

New method in `packages/api/src/services/BrigadeService.ts`:

```typescript
async getMyBrigadesCoordinator(organizerId: string) {
  return this.db.brigade.findMany({
    where:   { organizer_id: organizerId },
    select:  { id: true, name: true, community: true, status: true, join_code: true },
    orderBy: { start_date: 'desc' },
  })
}
```

Returns: `{ id, name, community, status, join_code }[]`

---

## 6. Admin Pages

### `/brigades` — `apps/admin/src/app/brigades/page.tsx`

Client component. Uses inline `useQuery` + `useMutation` following the `DoctorsTable` pattern.

**Queries:**
```typescript
const { data: brigades = [], isLoading } = useQuery({
  queryKey: ['brigades', 'mine'],
  queryFn: () => apiFetch<Brigade[]>('/api/brigades/mine'),
})

const createMutation = useMutation({
  mutationFn: (body: CreateBrigadeBody) =>
    apiFetch<{ id: string; join_code: string }>('/api/brigades', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  onSuccess: (data) => {
    qc.invalidateQueries({ queryKey: ['brigades', 'mine'] })
    setJoinCode(data.join_code)
    resetForm()
  },
})
```

**Create form fields:** name (required), community (required), start_date (required, datetime-local input), end_date (required, datetime-local input). Optional: municipality, department (omit from UI — can add later if needed).

**Join code display:** After successful create, show join code in a highlighted box:
```
✓ Brigada creada — código de acceso:
[ ABC123 ]
Comparte este código con los médicos
```

**Brigade list:** Each row links to `/brigades/[id]`. Show name, community, status badge (active = green, closed = gray).

**Types:**
```typescript
interface Brigade {
  id: string
  name: string
  community: string
  status: string
  join_code: string
}

interface CreateBrigadeBody {
  name: string
  community: string
  start_date: string  // ISO datetime string
  end_date: string
}
```

### `/brigades/[id]` — `apps/admin/src/app/brigades/[id]/page.tsx`

Client component. Tab state in URL: `?tab=dashboard` (default) or `?tab=report`.

**Params:** `{ params: { id: string } }`

Read tab from `useSearchParams()`. Switch tab via `router.push(`/brigades/${id}?tab=${tab}`)`.

**Dashboard tab query:**
```typescript
const { data: dashboard } = useQuery({
  queryKey: ['brigade', id, 'dashboard'],
  queryFn: () => apiFetch<BrigadeDashboard>(`/api/brigades/${id}/dashboard`),
})
```

Renders 4 stat cards: Total consultas, Atendidas, En espera, Médicos activos hoy.

**Report tab query:**
```typescript
const { data: report } = useQuery({
  queryKey: ['brigade', id, 'report'],
  queryFn: () => apiFetch<BrigadeReport>(`/api/brigades/${id}/report`),
  enabled: tab === 'report',
})
```

Renders: patient count (with breakdown: `brigade_patients` registered by brigade doctors vs `own_patients` registered independently), top diagnoses list.

**Types:**
```typescript
interface BrigadeDashboard {
  total: number
  attended: number
  waiting: number
  active_doctors: number
}

interface BrigadeReport {
  patient_count: number
  by_registration_mode: { self: number; brigade_doctor: number }
  top_diagnoses: { diagnosis: string; count: number }[]
}
```

---

## 7. Tests

### `packages/api/src/routes/brigades.test.ts` — additions

| Test | Assertion |
|------|-----------|
| `GET /mine` coordinator → 200 + own brigades only | Response is array with correct brigade data |
| `GET /mine` doctor role → 403 | |
| `GET /mine` no auth → 401 | |
| `GET /:id/dashboard` owner coordinator → 200 + stats shape | `{ total, attended, waiting, active_doctors }` all numbers |
| `GET /:id/dashboard` non-owner → 403 | |
| `GET /:id/report` owner coordinator → 200 + report shape | `{ patient_count, by_registration_mode, top_diagnoses }` |

---

## 8. File Map

| Action | File | Change |
|--------|------|--------|
| MOD | `packages/api/src/routes/brigades.ts` | Add `GET /mine` before `GET /:id` |
| MOD | `packages/api/src/services/BrigadeService.ts` | Add `getMyBrigadesCoordinator()` |
| MOD | `packages/api/src/routes/brigades.test.ts` | 6 new tests |
| MOD | `apps/admin/src/lib/auth.ts` | Add `getRole/setRole/clearRole`; update `clearToken` |
| MOD | `apps/admin/src/components/OtpForm.tsx` | Accept coordinator role + role-based redirect |
| MOD | `apps/admin/src/app/layout.tsx` | Role-aware redirect on login |
| MOD | `apps/admin/src/components/Sidebar.tsx` | Role-aware NAV |
| NEW | `apps/admin/src/app/brigades/page.tsx` | Brigade list + create form |
| NEW | `apps/admin/src/app/brigades/[id]/page.tsx` | Dashboard + report tabs |

---

## 9. Out of Scope

- Brigade status transitions (active → closed) from coordinator dashboard
- PDF report export
- Deleting brigades
- Editing brigade details after creation
- Coordinator seeing other coordinators' brigades
- Admin seeing brigade dashboard (admin role not granted access to `/brigades`)
- Frontend tests for admin pages (no Vitest setup in `apps/admin`)
