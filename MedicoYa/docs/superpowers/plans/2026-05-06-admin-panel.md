# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Phase 1 admin panel — install deps, add date picker to ConsultationsTable, add SPA fallback to Express, and verify build.

**Architecture:** Next.js 14 static export (`output: 'export'`, `basePath: '/admin'`) already scaffolded at `apps/admin/`. Express already serves `apps/admin/out` at `/admin` via `express.static`. Only three gaps remain: no `node_modules` (deps not installed), ConsultationsTable hardcodes today's date (no picker), and no SPA fallback for deep `/admin/*` routes.

**Tech Stack:** Next.js 14, @tanstack/react-query 5, Tailwind CSS 3, Express (existing).

---

### Task 1: Install dependencies

**Files:**
- Run: `npm install` inside `apps/admin/`

- [ ] **Step 1: Install admin deps**

```bash
cd apps/admin && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 2: Typecheck**

```bash
cd apps/admin && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/package-lock.json
git commit -m "chore(admin): install Next.js admin panel dependencies"
```

---

### Task 2: Add date picker to ConsultationsTable

**Files:**
- Modify: `apps/admin/src/components/ConsultationsTable.tsx`

The component currently hardcodes `const today = new Date().toISOString().split('T')[0]` and passes it to the query key and fetch URL. Replace with a `useState`-controlled date input. The heading changes from "Consultas hoy" to "Consultas" since any date is now selectable.

- [ ] **Step 1: Replace ConsultationsTable with date-picker version**

Replace the full file content:

```tsx
'use client'
import { useState } from 'react'
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
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])

  const { data = [], isLoading, dataUpdatedAt } = useQuery<Consultation[]>({
    queryKey:        ['consultations', date],
    queryFn:         () => apiFetch(`/api/admin/consultations?date=${date}`),
    refetchInterval: 30_000,
  })

  const ago = dataUpdatedAt
    ? `hace ${Math.round((Date.now() - dataUpdatedAt) / 1000)}s`
    : '—'

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">Consultas</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200"
        />
        <span className="text-slate-500 text-sm">↻ {ago}</span>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : data.length === 0 ? (
        <p className="text-slate-500">No hay consultas para esta fecha.</p>
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

- [ ] **Step 2: Typecheck**

```bash
cd apps/admin && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/ConsultationsTable.tsx
git commit -m "feat(admin): add date picker to ConsultationsTable"
```

---

### Task 3: Add SPA fallback to Express

**Files:**
- Modify: `packages/api/src/app.ts` — add one `app.get('/admin/*', ...)` line after the static serve

The static serve at line 31 (`app.use('/admin', express.static(...))`) handles direct asset requests. Without a fallback, deep routes like `/admin/doctors` return 404 on page refresh since there's no `doctors/index.html` in the static export. The fallback serves `index.html` for all unmatched `/admin/*` paths so client-side routing takes over.

Add the fallback immediately after the static serve line (line 31), before `app.use(helmet())`.

- [ ] **Step 1: Add SPA fallback**

In `packages/api/src/app.ts`, after line 31 (`app.use('/admin', express.static(...))`), insert:

```typescript
  app.get('/admin/*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../../apps/admin/out/index.html'))
  })
```

The file should look like:

```typescript
  app.use('/admin', express.static(path.join(__dirname, '../../../apps/admin/out')))
  app.get('/admin/*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../../apps/admin/out/index.html'))
  })

  app.use(helmet())
```

- [ ] **Step 2: Typecheck API**

```bash
cd packages/api && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run API tests to confirm no regression**

```bash
npm run test --workspace packages/api
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/app.ts
git commit -m "feat(admin): add SPA fallback for /admin/* routes"
```

---

### Task 4: Build verification

**Files:**
- Run: `npm run build:admin` from repo root

- [ ] **Step 1: Build admin panel**

```bash
npm run build:admin
```

Expected: Next.js static export completes, `apps/admin/out/` created containing `index.html`.

- [ ] **Step 2: Verify output**

```bash
ls apps/admin/out/
```

Expected: `index.html` present in output.

- [ ] **Step 3: Run API tests one final time**

```bash
npm run test --workspace packages/api
```

Expected: all tests pass.

- [ ] **Step 4: Commit build artifact (optional — skip if .gitignore excludes out/)**

Check `.gitignore`:
```bash
grep -r "admin/out" .gitignore apps/admin/.gitignore 2>/dev/null || echo "not ignored"
```

If `apps/admin/out` is NOT in `.gitignore`, commit it:
```bash
git add apps/admin/out/
git commit -m "build(admin): add compiled static export"
```

If it IS ignored, no commit needed — CI/CD builds it.

---

## Summary

| Task | Files | Gap filled |
|------|-------|-----------|
| 1 | `apps/admin/node_modules/` | deps not installed |
| 2 | `apps/admin/src/components/ConsultationsTable.tsx` | hardcoded today → date picker |
| 3 | `packages/api/src/app.ts` | SPA fallback missing |
| 4 | `apps/admin/out/` | build verification |
