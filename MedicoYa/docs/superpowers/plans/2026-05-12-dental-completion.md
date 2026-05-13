# Dental Feature Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete three missing dental features: hygiene notes + CPOD UI in the doctor visit screen, patient read-only dental view, and brigade ID tagging on visit creation.

**Architecture:** Add `GET /api/dental/files/mine` to the existing dental router (patient resolves their own file via `req.user.sub` which equals `Patient.id`). Add hygiene/CPOD fields inline in `DentalRecordScreen`. Inline the patient expediente (odontogram + visit list) in the patient `HistoryScreen` dental tab; visit detail goes to a new `PatientDentalVisitScreen`. Brigade linkage is a one-liner in `DentalExpedienteScreen`.

**Tech Stack:** React Native (Expo), TypeScript, Express, Prisma, Vitest + Supertest

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/api/src/routes/dental.ts` | Modify | Add `GET /files/mine` route |
| `packages/api/src/routes/dental.test.ts` | Create | Tests for `/files/mine` |
| `apps/mobile/src/screens/doctor/DentalRecordScreen.tsx` | Modify | Add hygiene notes + CPOD section |
| `apps/mobile/src/screens/doctor/DentalExpedienteScreen.tsx` | Modify | Pass brigade_id on visit create |
| `apps/mobile/src/screens/patient/HistoryScreen.tsx` | Modify | Add dental tab with odontogram + visits |
| `apps/mobile/src/screens/patient/PatientDentalVisitScreen.tsx` | Create | Read-only visit detail screen |
| `apps/mobile/src/navigation/RootNavigator.tsx` | Modify | Register `PatientDentalVisitScreen` |

---

## Task 1: API — GET /api/dental/files/mine

**Context:** `Patient.id === User.id` in the Prisma schema. `req.user!.sub` is the user ID, which is also the patient ID. `DentalService.getFileByPatient(patientId)` already queries `dentalPatientFile.findUnique({ where: { patient_id } })`. The new route just calls that with `req.user!.sub`.

**Files:**
- Modify: `packages/api/src/routes/dental.ts` (after line 134, before `GET /files/:fileId`)
- Create: `packages/api/src/routes/dental.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/api/src/routes/dental.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { Role, Language } from '@prisma/client'
import { createDentalRouter } from './dental'

const SECRET  = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID  = 'patient-uuid-1'
const FILE_ID = 'file-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockFile = {
  id: FILE_ID, patient_id: PAT_ID,
  created_at: new Date(), updated_at: new Date(),
  teeth: [], visits: [],
}

const mockDb = {
  dentalPatientFile: { findUnique: vi.fn(), create: vi.fn() },
  toothRecord:       { upsert: vi.fn() },
  dentalVisit:       { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  dentalTreatment:   { create: vi.fn(), update: vi.fn() },
  user:              { findMany: vi.fn(), create: vi.fn() },
}

function makeTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/dental', createDentalRouter(mockDb as any))
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/dental/files/mine', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp()).get('/api/dental/files/mine')
    expect(res.status).toBe(401)
  })

  it('returns 404 when patient has no file', async () => {
    mockDb.dentalPatientFile.findUnique.mockResolvedValue(null)
    const res = await request(makeTestApp())
      .get('/api/dental/files/mine')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(404)
  })

  it('returns file when patient has one', async () => {
    mockDb.dentalPatientFile.findUnique.mockResolvedValue(mockFile)
    const res = await request(makeTestApp())
      .get('/api/dental/files/mine')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(FILE_ID)
    expect(res.body.patient_id).toBe(PAT_ID)
  })

  it('queries by authenticated user sub as patient_id', async () => {
    mockDb.dentalPatientFile.findUnique.mockResolvedValue(mockFile)
    await request(makeTestApp())
      .get('/api/dental/files/mine')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(mockDb.dentalPatientFile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patient_id: PAT_ID } })
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/api && npx vitest run src/routes/dental.test.ts
```

Expected: 4 failures — route doesn't exist yet.

- [ ] **Step 3: Add the route to dental.ts**

In `packages/api/src/routes/dental.ts`, insert this block **after** the `GET /files/by-patient/:patientId` handler (line ~134) and **before** `GET /files/:fileId`:

```typescript
  router.get(
    '/files/mine',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const file = await service.getFileByPatient(req.user!.sub)
        if (!file) { res.status(404).json({ error: 'No dental file' }); return }
        res.json(file)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd packages/api && npx vitest run src/routes/dental.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/dental.ts packages/api/src/routes/dental.test.ts
git commit -m "feat(api): dental GET /files/mine — patient fetches own expediente"
```

---

## Task 2: DentalRecordScreen — Hygiene Notes + CPOD Index

**Context:** `DentalRecordScreen` is at `apps/mobile/src/screens/doctor/DentalRecordScreen.tsx`. The visit is already fetched on mount and stored in `visit` state. `visit.hygiene_notes` and `visit.cpod_index` are typed in `DentalVisit` (in `dentalTypes.ts`). The API already accepts these via `PATCH /api/dental/visits/:visitId` with `{ hygiene_notes, cpod_index }`. Insert the new section between the odontogram save button and "Plan de tratamiento".

**Files:**
- Modify: `apps/mobile/src/screens/doctor/DentalRecordScreen.tsx`

- [ ] **Step 1: Add state variables**

After the existing `const [savingPlan, setSavingPlan] = useState(false)` block (around line 61), add:

```typescript
  // Hygiene
  const [hygieneNotes,  setHygieneNotes]  = useState('')
  const [cpodIndex,     setCpodIndex]      = useState('')
  const [savingHygiene, setSavingHygiene]  = useState(false)
```

- [ ] **Step 2: Pre-populate on fetch**

In the `useEffect` `.then` block (around line 87), add after the existing `setReferralTo` and `setTreatmentPlan` calls:

```typescript
        setHygieneNotes(visitRes.data.hygiene_notes ?? '')
        setCpodIndex(visitRes.data.cpod_index?.toString() ?? '')
```

- [ ] **Step 3: Add save handler**

After `handleSavePlan` (around line 157), add:

```typescript
  const handleSaveHygiene = async () => {
    const cpod = cpodIndex.trim() ? parseInt(cpodIndex.trim(), 10) : null
    if (cpodIndex.trim() && (isNaN(cpod!) || cpod! < 0 || cpod! > 32)) {
      Alert.alert('CPOD inválido', 'Debe ser un número entre 0 y 32')
      return
    }
    setSavingHygiene(true)
    try {
      await api.patch(`/api/dental/visits/${visitId}`, {
        hygiene_notes: hygieneNotes.trim() || null,
        cpod_index:    cpod,
      })
      Alert.alert('Guardado')
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setSavingHygiene(false)
    }
  }
```

- [ ] **Step 4: Add JSX section**

In the JSX `<ScrollView>`, insert this block **after** the `{hasDirty && <TouchableOpacity ... Guardar odontograma ...>}` block and **before** `{/* Treatment plan */}`:

```tsx
        {/* Hygiene + CPOD */}
        <Text style={styles.sectionTitle}>Higiene oral</Text>
        <TextInput
          style={[styles.input, { minHeight: 80 }]}
          value={hygieneNotes}
          onChangeText={setHygieneNotes}
          placeholder="Observaciones de higiene oral..."
          placeholderTextColor={colors.text.muted}
          multiline
          numberOfLines={3}
        />
        <Text style={styles.sectionTitle}>Índice CPOD</Text>
        <TextInput
          style={styles.input}
          value={cpodIndex}
          onChangeText={setCpodIndex}
          placeholder="0 – 32"
          placeholderTextColor={colors.text.muted}
          keyboardType="numeric"
          maxLength={2}
        />
        <TouchableOpacity
          style={[styles.saveBtn, savingHygiene && styles.saveBtnDisabled]}
          onPress={handleSaveHygiene}
          disabled={savingHygiene}
        >
          {savingHygiene
            ? <ActivityIndicator color={colors.text.inverse} />
            : <Text style={styles.saveBtnText}>Guardar higiene</Text>}
        </TouchableOpacity>
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/doctor/DentalRecordScreen.tsx
git commit -m "feat(dental): hygiene notes + CPOD index UI in visit screen"
```

---

## Task 3: DentalExpedienteScreen — Brigade ID Linkage

**Context:** `brigadeStore` holds `activeBrigade: BrigadeInfo | null`. `BrigadeInfo.brigade_type` is `'medical' | 'dental' | undefined`. The API `POST /api/dental/files/:fileId/visits` already accepts optional `brigade_id`.

**Files:**
- Modify: `apps/mobile/src/screens/doctor/DentalExpedienteScreen.tsx`

- [ ] **Step 1: Add brigadeStore import**

At the top of `DentalExpedienteScreen.tsx`, after the existing imports, add:

```typescript
import { useBrigadeStore } from '../../store/brigadeStore'
```

- [ ] **Step 2: Read activeBrigade in the component**

At the top of the `DentalExpedienteScreen` function body, after the existing state declarations, add:

```typescript
  const activeBrigade = useBrigadeStore(s => s.activeBrigade)
```

- [ ] **Step 3: Pass brigade_id in handleNewVisit**

Replace the existing `api.post` call inside `handleNewVisit`:

```typescript
// Before:
      const { data } = await api.post<{ id: string }>(`/api/dental/files/${fileId}/visits`, {})

// After:
      const brigadeBody = activeBrigade?.brigade_type === 'dental'
        ? { brigade_id: activeBrigade.id }
        : {}
      const { data } = await api.post<{ id: string }>(`/api/dental/files/${fileId}/visits`, brigadeBody)
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/doctor/DentalExpedienteScreen.tsx
git commit -m "feat(dental): tag visits with brigade_id when active dental brigade"
```

---

## Task 4: Patient HistoryScreen — Dental Tab

**Context:** `apps/mobile/src/screens/patient/HistoryScreen.tsx` currently shows only medical consultations as a `FlatList`. Transform it to have Medical / Dental tabs. The dental tab fetches `GET /api/dental/files/mine` and displays the read-only odontogram + visit list inline (no separate expediente screen). Tapping a visit navigates to `PatientDentalVisitScreen`.

The `<Odontogram>` component lives at `src/screens/doctor/components/Odontogram.tsx`. Import it with a relative path.

**Files:**
- Modify: `apps/mobile/src/screens/patient/HistoryScreen.tsx`

- [ ] **Step 1: Replace the file with the new implementation**

```typescript
import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import type { ConsultationStatus } from '../../lib/types'
import type { DentalPatientFile, DentalVisit } from '../../lib/dentalTypes'
import Odontogram from '../doctor/components/Odontogram'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

interface ConsultationListItem {
  id: string
  status: ConsultationStatus
  diagnosis: string | null
  created_at: string
  prescription: { id: string } | null
}

const STATUS_COLORS: Record<ConsultationStatus, string> = {
  pending:   colors.status.amber,
  active:    colors.status.blue,
  completed: colors.brand.green400,
  rejected:  colors.status.red,
  cancelled: colors.text.muted,
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export default function PatientHistoryScreen({ navigation }: any) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<'medical' | 'dental'>('medical')

  const [medical, setMedical] = useState<ConsultationListItem[]>([])
  const [dentalFile, setDentalFile] = useState<DentalPatientFile | null>(null)
  const [dentalEmpty, setDentalEmpty] = useState(false)
  const [loadingMedical, setLoadingMedical] = useState(true)
  const [loadingDental, setLoadingDental] = useState(true)

  useEffect(() => {
    api.get<ConsultationListItem[]>('/api/consultations/my')
      .then(({ data }) => setMedical(data))
      .catch(() => {})
      .finally(() => setLoadingMedical(false))

    api.get<DentalPatientFile>('/api/dental/files/mine')
      .then(({ data }) => setDentalFile(data))
      .catch((err: any) => {
        if (err?.response?.status === 404) setDentalEmpty(true)
      })
      .finally(() => setLoadingDental(false))
  }, [])

  const handlePressConsultation = (item: ConsultationListItem) => {
    if (item.status === 'completed') {
      navigation.navigate('PrescriptionScreen', { consultationId: item.id })
    } else if (item.status === 'active' || item.status === 'pending') {
      navigation.navigate('ConsultationScreen', { consultationId: item.id })
    }
  }

  const loading = tab === 'medical' ? loadingMedical : loadingDental

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'medical' && styles.tabActive]}
          onPress={() => setTab('medical')}
        >
          <Text style={[styles.tabText, tab === 'medical' && styles.tabTextActive]}>
            {t('history.tab_medical')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'dental' && styles.tabActive]}
          onPress={() => setTab('dental')}
        >
          <Text style={[styles.tabText, tab === 'dental' && styles.tabTextActive]}>
            {t('history.tab_dental')}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand.green400} />
        </View>
      ) : tab === 'medical' ? (
        medical.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
          </View>
        ) : (
          <FlatList
            data={medical}
            keyExtractor={(i) => i.id}
            style={styles.screen}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const color = STATUS_COLORS[item.status] ?? colors.text.muted
              const date = new Date(item.created_at).toLocaleDateString()
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => handlePressConsultation(item)}
                  testID={`consultation-${item.id}`}
                >
                  <View style={styles.row}>
                    <Text style={styles.date}>{date}</Text>
                    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.badgeText, { color }]}>
                        {t(`history.status.${item.status}`)}
                      </Text>
                    </View>
                  </View>
                  {item.diagnosis && (
                    <Text style={styles.diagnosis}>{item.diagnosis}</Text>
                  )}
                </TouchableOpacity>
              )
            }}
          />
        )
      ) : dentalEmpty || !dentalFile ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('history.empty_dental')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.sectionTitle}>{t('dental.odontogram_title')}</Text>
          <Odontogram
            teeth={dentalFile.teeth}
            selectedFdi={null}
            onSelectTooth={() => {}}
          />
          <Text style={styles.sectionTitle}>
            {t('dental.visits_count', { count: dentalFile.visits.length })}
          </Text>
          {dentalFile.visits.length === 0 ? (
            <Text style={styles.emptyText}>{t('history.empty_dental')}</Text>
          ) : (
            dentalFile.visits.map((visit: DentalVisit) => (
              <TouchableOpacity
                key={visit.id}
                style={styles.card}
                onPress={() => navigation.navigate('PatientDentalVisitScreen', {
                  visitId: visit.id,
                  fileId: dentalFile.id,
                })}
              >
                <View style={styles.row}>
                  <Text style={styles.date}>{fmtDate(visit.visit_date)}</Text>
                  <View style={[styles.badge, { backgroundColor: colors.brand.green400 + '20' }]}>
                    <Text style={[styles.badgeText, { color: colors.brand.green400 }]}>
                      {visit.treatments.length} {t('dental.treatments').toLowerCase()}
                    </Text>
                  </View>
                </View>
                {visit.dentist && (
                  <Text style={styles.secondaryText}>
                    {visit.dentist.first_name && visit.dentist.last_name
                      ? `${visit.dentist.first_name} ${visit.dentist.last_name}`
                      : visit.dentist.name ?? t('dental.dentist_label')}
                  </Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: colors.surface.base },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText:     { fontSize: typography.size.base, color: colors.text.secondary, fontFamily: 'DMSans' },
  tabs:          { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.surface.border },
  tab:           { flex: 1, paddingVertical: spacing[3], alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: colors.brand.green400 },
  tabText:       { fontSize: typography.size.base, color: colors.text.secondary, fontFamily: 'DMSans' },
  tabTextActive: { color: colors.brand.green400, fontFamily: 'DMSansSemibold' },
  list:          { padding: spacing[4] },
  sectionTitle:  { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginTop: spacing[4], marginBottom: spacing[2] },
  card:          { backgroundColor: colors.surface.card, borderRadius: radius.md, padding: spacing[4], marginBottom: spacing[3], borderWidth: 1, borderColor: colors.surface.border },
  row:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[1] },
  date:          { fontSize: typography.size.md, color: colors.text.secondary, fontFamily: 'DMSans' },
  badge:         { borderRadius: radius.sm, paddingVertical: 2, paddingHorizontal: spacing[2] },
  badgeText:     { fontSize: typography.size.sm, fontFamily: 'DMSansSemibold' },
  diagnosis:     { fontSize: typography.size.base, color: colors.text.primary, fontFamily: 'DMSansMedium' },
  secondaryText: { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: 'DMSans' },
})
```

- [ ] **Step 2: Add missing i18n keys**

Open `apps/mobile/src/i18n/es.json` (or wherever translations live) and add any missing keys. Check existing keys first:

```bash
grep -n "tab_medical\|tab_dental\|empty_dental\|odontogram_title\|visits_count\|dentist_label" apps/mobile/src/i18n/es.json
```

Add missing ones. Minimum required:
- `history.tab_medical` — "Médico"
- `history.tab_dental` — "Dental"
- `history.empty_dental` — "Sin visitas dentales"
- `dental.odontogram_title` — "Odontograma"
- `dental.visits_count` — "Visitas ({{count}})"
- `dental.dentist_label` — "Dentista"

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/patient/HistoryScreen.tsx apps/mobile/src/i18n/
git commit -m "feat(dental): patient HistoryScreen dental tab — odontogram + visits"
```

---

## Task 5: PatientDentalVisitScreen — Read-Only Visit Detail

**Context:** New screen. Receives `{ visitId, fileId }` params. Fetches `GET /api/dental/visits/:visitId` (returns `DentalVisit` including `treatments`) and `GET /api/dental/files/:fileId` (returns `DentalPatientFile` including `teeth`). Displays everything read-only: odontogram, hygiene notes, CPOD, treatment plan, referral, treatment cards.

**Files:**
- Create: `apps/mobile/src/screens/patient/PatientDentalVisitScreen.tsx`

- [ ] **Step 1: Create the file**

```typescript
import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import api from '../../lib/api'
import type { DentalVisit, ToothRecord } from '../../lib/dentalTypes'
import Odontogram from '../doctor/components/Odontogram'
import { tokens } from '../../theme/tokens'

const { colors, spacing, radius, typography } = tokens

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function fmtDatetime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function PatientDentalVisitScreen({ route }: any) {
  const insets = useSafeAreaInsets()
  const { visitId, fileId } = route.params as { visitId: string; fileId: string }

  const [visit, setVisit] = useState<DentalVisit | null>(null)
  const [teeth, setTeeth] = useState<ToothRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<DentalVisit>(`/api/dental/visits/${visitId}`),
      api.get<{ teeth: ToothRecord[] }>(`/api/dental/files/${fileId}`),
    ])
      .then(([visitRes, fileRes]) => {
        setVisit(visitRes.data)
        setTeeth(fileRes.data.teeth)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [visitId, fileId])

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.brand.green400} size="large" />
      </View>
    )
  }

  if (!visit) return null

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4] }]}
    >
      <Text style={styles.title}>Visita dental</Text>
      <Text style={styles.subtitle}>{fmtDate(visit.visit_date)}</Text>

      {visit.dentist && (
        <Text style={styles.dentist}>
          {visit.dentist.first_name && visit.dentist.last_name
            ? `${visit.dentist.first_name} ${visit.dentist.last_name}`
            : visit.dentist.name ?? 'Dentista'}
        </Text>
      )}

      <Text style={styles.sectionTitle}>Odontograma</Text>
      <Odontogram teeth={teeth} selectedFdi={null} onSelectTooth={() => {}} />

      {visit.hygiene_notes ? (
        <>
          <Text style={styles.sectionTitle}>Higiene oral</Text>
          <Text style={styles.bodyText}>{visit.hygiene_notes}</Text>
        </>
      ) : null}

      {visit.cpod_index != null ? (
        <>
          <Text style={styles.sectionTitle}>Índice CPOD</Text>
          <Text style={styles.bodyText}>{visit.cpod_index}</Text>
        </>
      ) : null}

      {visit.treatment_plan ? (
        <>
          <Text style={styles.sectionTitle}>Plan de tratamiento</Text>
          <Text style={styles.bodyText}>{visit.treatment_plan}</Text>
        </>
      ) : null}

      {visit.referral_to ? (
        <>
          <Text style={styles.sectionTitle}>Referencia</Text>
          <Text style={styles.bodyText}>{visit.referral_to}</Text>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>
        Tratamientos ({visit.treatments.length})
      </Text>

      {visit.treatments.length === 0 ? (
        <Text style={styles.emptyText}>Sin tratamientos registrados.</Text>
      ) : (
        visit.treatments.map(tx => (
          <View key={tx.id} style={styles.txCard}>
            <Text style={styles.txProcedure}>{tx.procedure}</Text>
            {tx.tooth_fdi != null && (
              <Text style={styles.txMeta}>Pieza {tx.tooth_fdi}</Text>
            )}
            {tx.notes ? (
              <Text style={styles.txNotes}>{tx.notes}</Text>
            ) : null}
            {(tx.started_at || tx.ended_at) && (
              <View style={{ marginTop: spacing[1] }}>
                {tx.started_at ? (
                  <Text style={styles.txDate}>Inicio: {fmtDatetime(tx.started_at)}</Text>
                ) : null}
                {tx.ended_at ? (
                  <Text style={styles.txDate}>Fin: {fmtDatetime(tx.ended_at)}</Text>
                ) : null}
              </View>
            )}
            {tx.materials && tx.materials.length > 0 && (
              <View style={styles.materialsRow}>
                {tx.materials.map((m, i) => (
                  <View key={i} style={styles.materialChip}>
                    <Text style={styles.materialChipText}>{m}</Text>
                  </View>
                ))}
              </View>
            )}
            {(tx.before_image_url || tx.after_image_url) && (
              <View style={styles.imagesRow}>
                {tx.before_image_url && (
                  <View style={styles.imageWrapper}>
                    <Text style={styles.imageLabel}>Antes</Text>
                    <Image
                      source={{ uri: tx.before_image_url }}
                      style={styles.txImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
                {tx.after_image_url && (
                  <View style={styles.imageWrapper}>
                    <Text style={styles.imageLabel}>Después</Text>
                    <Image
                      source={{ uri: tx.after_image_url }}
                      style={styles.txImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.surface.base },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.base },
  scroll:           { padding: spacing[4], paddingBottom: spacing[12] },
  title:            { fontSize: typography.size.xl, fontFamily: 'DMSerifDisplay', color: colors.text.primary, marginBottom: 2 },
  subtitle:         { fontSize: typography.size.sm, color: colors.text.secondary, fontFamily: 'DMSans', marginBottom: 2 },
  dentist:          { fontSize: typography.size.sm, color: colors.text.muted, fontFamily: 'DMSans', marginBottom: spacing[2] },
  sectionTitle:     { fontSize: typography.size.base, fontFamily: 'DMSansSemibold', color: colors.text.primary, marginTop: spacing[4], marginBottom: spacing[2] },
  bodyText:         { fontSize: typography.size.md, color: colors.text.primary, fontFamily: 'DMSans', lineHeight: 22 },
  emptyText:        { color: colors.text.secondary, fontFamily: 'DMSans', fontSize: typography.size.sm },
  txCard:           { backgroundColor: colors.surface.card, borderRadius: radius.sm, padding: spacing[3], marginBottom: spacing[2], borderWidth: 1, borderColor: colors.surface.border },
  txProcedure:      { color: colors.text.primary, fontFamily: 'DMSansSemibold', fontSize: typography.size.md },
  txMeta:           { color: colors.text.brand, fontSize: typography.size.sm, fontFamily: 'DMSans', marginTop: 2 },
  txNotes:          { color: colors.text.secondary, fontSize: typography.size.sm, fontFamily: 'DMSans', marginTop: 2 },
  txDate:           { color: colors.text.secondary, fontSize: typography.size.xs, fontFamily: 'DMSans' },
  materialsRow:     { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[2], gap: spacing[1] },
  materialChip:     { backgroundColor: colors.surface.cardBrand, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  materialChipText: { color: colors.text.brand, fontSize: typography.size.xs, fontFamily: 'DMSans' },
  imagesRow:        { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  imageWrapper:     { flex: 1 },
  imageLabel:       { color: colors.text.secondary, fontSize: typography.size.xs, fontFamily: 'DMSansSemibold', marginBottom: 4, textTransform: 'uppercase' },
  txImage:          { width: '100%', height: 120, borderRadius: radius.sm },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/screens/patient/PatientDentalVisitScreen.tsx
git commit -m "feat(dental): PatientDentalVisitScreen — read-only dental visit detail"
```

---

## Task 6: Register PatientDentalVisitScreen in Navigation

**Context:** The patient navigation stack is a `NativeStackNavigator` defined inside `RootNavigator.tsx` as `PatientRoot`. Add the new screen here so it's reachable from the patient `HistoryScreen`.

**Files:**
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Add import**

At the top of `RootNavigator.tsx`, after the existing imports, add:

```typescript
import PatientDentalVisitScreen from '../screens/patient/PatientDentalVisitScreen'
```

- [ ] **Step 2: Add to param list**

In `PatientStackParamList`, add:

```typescript
  PatientDentalVisitScreen: { visitId: string; fileId: string }
```

- [ ] **Step 3: Register screen**

Inside `<PatientStack.Navigator>`, after the `PrescriptionScreen` entry, add:

```tsx
      <PatientStack.Screen
        name="PatientDentalVisitScreen"
        component={PatientDentalVisitScreen}
        options={{ headerShown: true, title: 'Visita dental' }}
      />
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/RootNavigator.tsx
git commit -m "feat(dental): register PatientDentalVisitScreen in patient nav stack"
```

---

## Task 7: Verification

- [ ] **Step 1: Run API tests**

```bash
cd packages/api && npx vitest run
```

Expected: all passing including the 4 new dental tests.

- [ ] **Step 2: TypeScript check — API**

```bash
cd packages/api && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: TypeScript check — mobile**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test — doctor**

1. Open app as doctor
2. Navigate to Dental tab → pick a patient → open a visit
3. Confirm hygiene notes textarea and CPOD numeric input appear between odontogram save button and treatment plan
4. Enter values, tap "Guardar higiene" — confirm alert "Guardado"
5. Navigate away and back — confirm values persist (fetched from API)

- [ ] **Step 5: Manual smoke test — patient**

1. Open app as patient (patient must have an existing dental file)
2. Navigate to History → tap Dental tab
3. Confirm read-only odontogram appears at top
4. Confirm visit list appears below
5. Tap a visit → confirm `PatientDentalVisitScreen` opens with visit details
6. Confirm no inputs or save buttons are present

- [ ] **Step 6: Manual smoke test — brigade linkage**

1. Open app as doctor, join a dental brigade (brigade_type = 'dental')
2. Open a patient dental expediente → tap "+ Nueva visita"
3. In API logs / DB, confirm the created `DentalVisit` has the correct `brigade_id`
