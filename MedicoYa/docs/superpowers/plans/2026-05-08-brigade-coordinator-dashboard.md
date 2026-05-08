# Brigade Coordinator Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add coordinator role to the admin web app — role-aware login redirect, sidebar, brigade list page with create form, and brigade detail page with dashboard + report tabs.

**Architecture:** One new API endpoint (`GET /api/brigades/mine` for coordinator), role stored in localStorage alongside JWT, two new Next.js App Router pages using inline react-query hooks following the existing DoctorsTable pattern.

**Tech Stack:** Express + Prisma + Vitest (API), Next.js 14 App Router + @tanstack/react-query + Tailwind (admin)

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| MOD | `packages/api/src/services/BrigadeService.ts` | Add `getMyBrigadesCoordinator()` |
| MOD | `packages/api/src/routes/brigades.ts` | Add `GET /mine` before `GET /:id` |
| MOD | `packages/api/src/routes/brigades.test.ts` | 3 new tests for `GET /mine` |
| MOD | `apps/admin/src/lib/auth.ts` | Add `getRole / setRole / clearRole`, update `clearToken` |
| MOD | `apps/admin/src/components/OtpForm.tsx` | Accept coordinator role, redirect to /brigades |
| MOD | `apps/admin/src/app/layout.tsx` | Role-aware redirect on login |
| MOD | `apps/admin/src/components/Sidebar.tsx` | Role-aware NAV |
| NEW | `apps/admin/src/app/brigades/page.tsx` | Brigade list + create form |
| NEW | `apps/admin/src/app/brigades/[id]/page.tsx` | Dashboard + report tabs |

---

### Task 1: API — `GET /api/brigades/mine`

**Files:**
- Modify: `packages/api/src/services/BrigadeService.ts`
- Modify: `packages/api/src/routes/brigades.ts`
- Modify: `packages/api/src/routes/brigades.test.ts`

**Context:** `GET /api/brigades` (no path suffix) lists brigades where the caller is a *member* (doctor role via `BrigadeDoctor`). Coordinators need a separate endpoint listing brigades they *own* (`organizer_id = caller`). Dashboard and report routes already exist and are tested — only `GET /mine` is new.

The `mockDb` in the test file has `brigade: { create, findUnique, findFirst }` but is missing `findMany`. Add it.

- [ ] **Step 1: Add `brigade.findMany` to `mockDb` in test file**

In `packages/api/src/routes/brigades.test.ts`, find the `mockDb` object (around line 33) and add `findMany: vi.fn()` to `mockDb.brigade`:

```typescript
const mockDb = {
  brigade: {
    create:     vi.fn(),
    findUnique: vi.fn(),
    findFirst:  vi.fn(),
    findMany:   vi.fn(),   // ADD THIS LINE
  },
  brigadeDoctor: {
    findUnique: vi.fn(),
    create:     vi.fn(),
    findMany:   vi.fn(),
  },
  consultation: {
    count:    vi.fn(),
    findMany: vi.fn(),
    groupBy:  vi.fn(),
  },
  patient: {
    count: vi.fn(),
  },
}
```

- [ ] **Step 2: Write 3 failing tests for `GET /api/brigades/mine`**

Add at the end of `packages/api/src/routes/brigades.test.ts`:

```typescript
// --- GET /mine (coordinator) ---

describe('GET /api/brigades/mine', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp()).get('/api/brigades/mine')
    expect(res.status).toBe(401)
  })

  it('returns 403 for doctor role', async () => {
    const res = await request(makeTestApp())
      .get('/api/brigades/mine')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(403)
  })

  it('returns coordinator\'s own brigades — 200 + array with join_code', async () => {
    mockDb.brigade.findMany.mockResolvedValue([
      { id: BRIGADE_ID, name: 'Brigada Norte', community: 'Comunidad X', status: 'active', join_code: 'ABC123' },
    ])
    const res = await request(makeTestApp())
      .get('/api/brigades/mine')
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(BRIGADE_ID)
    expect(res.body[0].join_code).toBe('ABC123')
  })
})
```

- [ ] **Step 3: Run tests — verify the 3 new tests fail**

```bash
cd packages/api && npx vitest run src/routes/brigades.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: 3 failures in `GET /api/brigades/mine` describe block (route not found → 404, not the expected status).

- [ ] **Step 4: Add `getMyBrigadesCoordinator` to `BrigadeService`**

In `packages/api/src/services/BrigadeService.ts`, add this method after `getBrigadeByCode` (around line 198):

```typescript
async getMyBrigadesCoordinator(organizerId: string) {
  return this.db.brigade.findMany({
    where:   { organizer_id: organizerId },
    select:  { id: true, name: true, community: true, status: true, join_code: true },
    orderBy: { start_date: 'desc' },
  })
}
```

- [ ] **Step 5: Add `GET /mine` route to `brigades.ts`**

In `packages/api/src/routes/brigades.ts`, add the following block AFTER the `GET /by-code/:code` handler and BEFORE the `GET /:id` handler (currently around line 64). This ordering is critical — `mine` must be registered before `/:id` or Express will treat `mine` as an `:id` parameter.

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

- [ ] **Step 6: Run full brigades test suite — all tests must pass**

```bash
cd packages/api && npx vitest run src/routes/brigades.test.ts --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass (existing + 3 new).

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/services/BrigadeService.ts packages/api/src/routes/brigades.ts packages/api/src/routes/brigades.test.ts
git commit -m "feat(api): add GET /api/brigades/mine for coordinator role"
```

---

### Task 2: Auth utilities — role storage + login redirect

**Files:**
- Modify: `apps/admin/src/lib/auth.ts`
- Modify: `apps/admin/src/components/OtpForm.tsx`
- Modify: `apps/admin/src/app/layout.tsx`

**Context:** Token is stored in `localStorage` under key `medicoya_admin_token`. Role needs to be stored the same way under a new key. `OtpForm` currently blocks anyone whose role is not `admin`. `layout.tsx` redirects all authenticated users to `/doctors`. Both need to be role-aware.

No test framework is set up in `apps/admin` — no tests for this task.

- [ ] **Step 1: Update `auth.ts` — add role storage**

Replace the entire contents of `apps/admin/src/lib/auth.ts` with:

```typescript
const TOKEN_KEY = 'medicoya_admin_token'
const ROLE_KEY  = 'medicoya_admin_role'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getRole(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ROLE_KEY)
}

export function setRole(role: string): void {
  localStorage.setItem(ROLE_KEY, role)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
}
```

- [ ] **Step 2: Update `OtpForm.tsx` — accept coordinator, role-based redirect**

In `apps/admin/src/components/OtpForm.tsx`, update the import line and the `verifyOtp` function:

```typescript
import { setToken, setRole } from '../lib/auth'
```

Replace the entire `verifyOtp` function body (the try block inside it) with:

```typescript
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
    const role = body.user?.role
    if (role !== 'admin' && role !== 'coordinator') {
      setError('Acceso denegado.')
      return
    }
    setToken(body.token)
    setRole(role)
    router.replace(role === 'coordinator' ? '/brigades' : '/doctors')
  } finally {
    setLoading(false)
  }
}
```

- [ ] **Step 3: Update `layout.tsx` — role-aware redirect**

In `apps/admin/src/app/layout.tsx`, update the import to include `getRole`:

```typescript
import { getToken, getRole } from '../lib/auth'
```

Replace the `useEffect` body with:

```typescript
useEffect(() => {
  const token = getToken()
  if (!token && pathname !== '/') router.replace('/')
  if (token && pathname === '/') {
    const role = getRole()
    router.replace(role === 'coordinator' ? '/brigades' : '/doctors')
  }
}, [pathname, router])
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/lib/auth.ts apps/admin/src/components/OtpForm.tsx apps/admin/src/app/layout.tsx
git commit -m "feat(admin): role-aware auth redirect for coordinator"
```

---

### Task 3: Sidebar — role-aware NAV

**Files:**
- Modify: `apps/admin/src/components/Sidebar.tsx`

**Context:** The current `NAV` array is static (`/doctors`, `/consultations`). Coordinators should only see `🚑 Brigadas`. The role is read from localStorage via `getRole()`.

- [ ] **Step 1: Update `Sidebar.tsx`**

Replace the entire contents of `apps/admin/src/components/Sidebar.tsx` with:

```typescript
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearToken, getRole } from '../lib/auth'

const ADMIN_NAV = [
  { href: '/doctors',       label: 'Médicos' },
  { href: '/consultations', label: 'Consultas' },
]

const COORDINATOR_NAV = [
  { href: '/brigades', label: '🚑 Brigadas' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const role     = getRole()
  const nav      = role === 'coordinator' ? COORDINATOR_NAV : ADMIN_NAV

  function logout() {
    clearToken()
    router.replace('/')
  }

  return (
    <aside className="w-48 min-h-screen bg-slate-900 flex flex-col p-4 shrink-0">
      <div className="text-sky-400 font-bold text-sm mb-6">MédicoYa Admin</div>
      <nav className="flex flex-col gap-1 flex-1">
        {nav.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2 rounded text-sm transition-colors ${
              pathname.startsWith(href)
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

Note: `pathname.startsWith(href)` instead of `pathname === href` so `/brigades/[id]` also highlights the Brigadas nav item.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/components/Sidebar.tsx
git commit -m "feat(admin): role-aware sidebar nav for coordinator"
```

---

### Task 4: `/brigades` page — brigade list + create form

**Files:**
- Create: `apps/admin/src/app/brigades/page.tsx`

**Context:** This is a Next.js App Router page. Must be a client component (`'use client'`) because it uses react-query hooks. Pattern: inline `useQuery` + `useMutation` with `apiFetch`, following `DoctorsTable.tsx`. No separate hooks file.

The API endpoint is `GET /api/brigades/mine` (returns `{ id, name, community, status, join_code }[]`). Create POSTs to `POST /api/brigades` (existing endpoint) which returns `{ id, join_code, ... }`.

`datetime-local` inputs return strings like `"2026-05-10T08:00"` (no timezone). Convert to ISO via `new Date(value).toISOString()` before sending to API.

- [ ] **Step 1: Create the page**

Create `apps/admin/src/app/brigades/page.tsx` with:

```typescript
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { apiFetch } from '../../lib/api'

interface Brigade {
  id: string
  name: string
  community: string
  status: string
  join_code: string
}

export default function BrigadesPage() {
  const qc = useQueryClient()
  const [name,      setName]      = useState('')
  const [community, setCommunity] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [joinCode,  setJoinCode]  = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const { data: brigades = [], isLoading } = useQuery<Brigade[]>({
    queryKey: ['brigades', 'mine'],
    queryFn:  () => apiFetch('/api/brigades/mine'),
  })

  const createMutation = useMutation({
    mutationFn: (body: { name: string; community: string; start_date: string; end_date: string }) =>
      apiFetch<{ id: string; join_code: string }>('/api/brigades', {
        method: 'POST',
        body:   JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['brigades', 'mine'] })
      setJoinCode(data.join_code)
      setName(''); setCommunity(''); setStartDate(''); setEndDate('')
      setFormError('')
    },
    onError: (err: Error) => setFormError(err.message),
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !community.trim() || !startDate || !endDate) {
      setFormError('Todos los campos son requeridos.')
      return
    }
    setFormError('')
    createMutation.mutate({
      name:       name.trim(),
      community:  community.trim(),
      start_date: new Date(startDate).toISOString(),
      end_date:   new Date(endDate).toISOString(),
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🚑 Mis Brigadas</h1>

      {/* Brigade list */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-3">Brigadas</h2>
        {isLoading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : brigades.length === 0 ? (
          <p className="text-slate-500 text-sm">No tienes brigadas aún.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {brigades.map(b => (
              <div key={b.id} className="bg-slate-900 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-slate-400 text-sm">{b.community}</p>
                  <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                    b.status === 'active'
                      ? 'bg-green-900 text-green-300'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {b.status === 'active' ? '● activa' : '● cerrada'}
                  </span>
                </div>
                <Link
                  href={`/brigades/${b.id}`}
                  className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded transition-colors shrink-0"
                >
                  Ver →
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create form */}
      <section className="border-t border-slate-800 pt-6">
        <h2 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-4">Nueva brigada</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 max-w-md">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre *"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <input
            value={community}
            onChange={e => setCommunity(e.target.value)}
            placeholder="Comunidad *"
            className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Inicio *</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Fin *</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
          {formError && <p className="text-red-400 text-sm">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded px-4 py-2 font-medium transition-colors"
          >
            {createMutation.isPending ? 'Creando...' : 'Crear brigada'}
          </button>
        </form>

        {joinCode && (
          <div className="mt-4 max-w-md bg-slate-900 border border-green-600 rounded-lg p-4">
            <p className="text-green-400 text-sm mb-2">✓ Brigada creada — código de acceso:</p>
            <p className="text-4xl font-bold text-white tracking-widest text-center py-2">{joinCode}</p>
            <p className="text-slate-500 text-xs text-center mt-1">Comparte este código con los médicos</p>
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/brigades/page.tsx
git commit -m "feat(admin): /brigades page — brigade list + create form"
```

---

### Task 5: `/brigades/[id]` page — dashboard + report tabs

**Files:**
- Create: `apps/admin/src/app/brigades/[id]/page.tsx`

**Context:** Next.js dynamic route. Tab state lives in the URL query param (`?tab=dashboard` default, `?tab=report`). Dashboard query always fetches on mount. Report query is lazy — only fetches when `tab === 'report'` (via `enabled` flag in `useQuery`). Both queries use `requireBrigadeOwner` on the API side — a 403 means the coordinator doesn't own this brigade.

API response shapes:
- Dashboard: `{ total: number; attended: number; waiting: number; active_doctors: number }`
- Report: `{ patient_count: number; by_registration_mode: { self: number; brigade_doctor: number }; top_diagnoses: { diagnosis: string; count: number }[] }`

- [ ] **Step 1: Create the page directory and file**

Create directory `apps/admin/src/app/brigades/[id]/` then create `page.tsx`:

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { apiFetch } from '../../../lib/api'

interface BrigadeDashboard {
  total:          number
  attended:       number
  waiting:        number
  active_doctors: number
}

interface BrigadeReport {
  patient_count:        number
  by_registration_mode: { self: number; brigade_doctor: number }
  top_diagnoses:        { diagnosis: string; count: number }[]
}

export default function BrigadeDetailPage() {
  const { id }       = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const tab          = searchParams.get('tab') ?? 'dashboard'

  const { data: dashboard, isLoading: loadingDash } = useQuery<BrigadeDashboard>({
    queryKey: ['brigade', id, 'dashboard'],
    queryFn:  () => apiFetch(`/api/brigades/${id}/dashboard`),
  })

  const { data: report, isLoading: loadingReport } = useQuery<BrigadeReport>({
    queryKey: ['brigade', id, 'report'],
    queryFn:  () => apiFetch(`/api/brigades/${id}/report`),
    enabled:  tab === 'report',
  })

  function setTab(t: 'dashboard' | 'report') {
    router.push(`/brigades/${id}?tab=${t}`)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">🚑 Brigada</h1>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 mb-6">
        {(['dashboard', 'report'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
              tab === t
                ? 'text-sky-400 border-b-2 border-sky-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'dashboard' ? 'Dashboard' : 'Reporte'}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && (
        loadingDash ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : dashboard ? (
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <StatCard label="Total consultas"    value={dashboard.total}          color="text-white" />
            <StatCard label="Atendidas"          value={dashboard.attended}       color="text-green-400" />
            <StatCard label="En espera"          value={dashboard.waiting}        color="text-yellow-400" />
            <StatCard label="Médicos activos hoy" value={dashboard.active_doctors} color="text-sky-400" />
          </div>
        ) : null
      )}

      {/* Report tab */}
      {tab === 'report' && (
        loadingReport ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : report ? (
          <div className="max-w-md flex flex-col gap-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Pacientes registrados</p>
              <p className="text-3xl font-bold text-white">{report.patient_count}</p>
              <p className="text-xs text-slate-500 mt-1">
                {report.by_registration_mode.brigade_doctor} brigada · {report.by_registration_mode.self} propio
              </p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-sky-400 text-sm font-semibold mb-3">Top diagnósticos</p>
              {report.top_diagnoses.length === 0 ? (
                <p className="text-slate-500 text-sm">Sin diagnósticos aún.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {report.top_diagnoses.map((d, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-400">{d.diagnosis}</span>
                      <span className="text-white font-medium">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-900 rounded-lg p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-slate-400 text-xs mt-1">{label}</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/admin/src/app/brigades/[id]/page.tsx"
git commit -m "feat(admin): /brigades/[id] page — dashboard + report tabs"
```

---

### Task 6: Full verification

**Files:** none

- [ ] **Step 1: Run full API test suite**

```bash
cd packages/api && npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass. Look for any failures in brigades.test.ts.

- [ ] **Step 2: Build admin app**

```bash
cd apps/admin && npm run build 2>&1 | tail -30
```

Expected: build succeeds with no TypeScript errors. If there are errors, fix them before proceeding.

- [ ] **Step 3: Manual smoke test (if running locally)**

Start API: `cd packages/api && npm run dev`
Start admin: `cd apps/admin && npm run dev`

1. Open http://localhost:3001
2. Log in with a coordinator phone number
3. Verify redirect goes to `/brigades` (not `/doctors`)
4. Verify sidebar shows only "🚑 Brigadas"
5. Verify brigade list loads
6. Create a brigade — verify join code appears
7. Click "Ver →" on a brigade — verify dashboard tab loads with stat cards
8. Click "Reporte" tab — verify report loads

- [ ] **Step 4: Log out and log back in as admin**

Verify admin still sees `/doctors` redirect and Médicos + Consultas in sidebar.
