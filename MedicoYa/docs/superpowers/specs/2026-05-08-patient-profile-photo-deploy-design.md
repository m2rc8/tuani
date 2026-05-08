# Patient Profile, Symptom Photo & Railway Deploy — Design Spec

**Date:** 2026-05-08
**Project:** MédicoYa
**Scope:** Three small Phase 1 gaps: patient profile editing, optional symptom photo, Railway deployment.

---

## 1. Decisions

| Question | Decision |
|----------|----------|
| Patient profile API pattern | `GET/PUT /api/patients/me` — mirrors existing `GET /api/doctors/me` |
| Profile screen | New `PatientProfileScreen` in `screens/patient/`; `PatientTabs` updated to use it |
| Photo picker | `expo-image-picker` (camera + gallery) + `expo-image-manipulator` (compress to <500KB) |
| Photo upload | Append to existing `POST /api/consultations` FormData — zero API changes needed |
| Deploy target | Railway.app — Nixpacks builder, existing `npm run build` + `npm run start` scripts |
| DB migration on deploy | `prisma migrate deploy` runs in `startCommand` before app start |
| No migration needed | `User.name`, `Patient.dob`, `Patient.allergies` already in schema |

---

## 2. Section 1 — Patient Profile API

### New: `packages/api/src/services/PatientService.ts`

```typescript
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const updateProfileSchema = z.object({
  name:      z.string().min(1).max(100).optional(),
  dob:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  allergies: z.string().max(500).nullable().optional(),
})

export type UpdateProfileData = z.infer<typeof updateProfileSchema>

export interface PatientProfile {
  name:      string | null
  phone:     string
  dob:       Date | null
  allergies: string | null
}

export class PatientError extends Error {
  constructor(public readonly code: 'NOT_FOUND', message: string) {
    super(message)
    this.name = 'PatientError'
  }
}

export class PatientService {
  constructor(private readonly db: PrismaClient) {}

  async getProfile(userId: string): Promise<PatientProfile> {
    const user = await this.db.user.findUnique({
      where:   { id: userId },
      include: { patient: { select: { dob: true, allergies: true } } },
    })
    if (!user || !user.patient) throw new PatientError('NOT_FOUND', 'Patient not found')
    return {
      name:      user.name,
      phone:     user.phone,
      dob:       user.patient.dob,
      allergies: user.patient.allergies,
    }
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<PatientProfile> {
    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data:  { name: data.name },
      }),
      this.db.patient.update({
        where: { id: userId },
        data: {
          dob:       data.dob !== undefined ? (data.dob ? new Date(data.dob) : null) : undefined,
          allergies: data.allergies !== undefined ? data.allergies : undefined,
        },
      }),
    ])
    return this.getProfile(userId)
  }
}
```

### New: `packages/api/src/routes/patients.ts`

```typescript
import { Router, Request, Response } from 'express'
import { Role } from '@prisma/client'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { PatientService, PatientError, updateProfileSchema } from '../services/PatientService'

function handlePatientError(err: unknown, res: Response): boolean {
  if (err instanceof PatientError) {
    res.status(404).json({ error: err.message })
    return true
  }
  return false
}

export function createPatientsRouter(service: PatientService): Router {
  const router = Router()

  router.get(
    '/me',
    requireAuth,
    requireRole(Role.patient),
    async (req: Request, res: Response): Promise<void> => {
      try {
        res.json(await service.getProfile(req.user!.sub))
      } catch (err) {
        if (!handlePatientError(err, res)) throw err
      }
    }
  )

  router.put(
    '/me',
    requireAuth,
    requireRole(Role.patient),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = updateProfileSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid profile data' })
        return
      }
      try {
        res.json(await service.updateProfile(req.user!.sub, parsed.data))
      } catch (err) {
        if (!handlePatientError(err, res)) throw err
      }
    }
  )

  return router
}
```

### Modified: `packages/api/src/app.ts`

Add to imports:
```typescript
import { PatientService } from './services/PatientService'
import { createPatientsRouter } from './routes/patients'
```

Add to `createApp`:
```typescript
const patientService = new PatientService(db)
app.use('/api/patients', createPatientsRouter(patientService))
```

### New: `packages/api/src/routes/patients.test.ts`

Tests:
| Test | Assertion |
|------|-----------|
| `GET /me` no auth → 401 | |
| `GET /me` doctor role → 403 | |
| `GET /me` patient → 200 + profile shape | `{ name, phone, dob, allergies }` |
| `PUT /me` no auth → 401 | |
| `PUT /me` invalid dob → 400 | dob `"not-a-date"` rejected |
| `PUT /me` valid fields → 200 + updated profile | name + dob + allergies updated |
| `PUT /me` null dob → 200 + dob null | clears dob field |

---

## 3. Section 2 — Patient Profile Mobile

### New: `apps/mobile/src/screens/patient/PatientProfileScreen.tsx`

- Mounts: `GET /api/patients/me` → populate name/dob/allergies state
- Fields: Name (`TextInput`), DOB (`TextInput`, placeholder `YYYY-MM-DD`), Allergies (`TextInput` multiline)
- Save button: `PUT /api/patients/me` → show "Saved ✓" for 2s
- Language selector (ES / EN toggles, same as current ProfileScreen)
- Logout button

```typescript
'use client'
// Full screen: load profile → edit → save → feedback
// Role: patient only (PatientTabs is already role-gated)
```

### Modified: `apps/mobile/src/navigation/PatientTabs.tsx`

```typescript
import PatientProfileScreen from '../screens/patient/PatientProfileScreen'
// replace:  <Tab.Screen name="Profile" component={ProfileScreen} .../>
// with:     <Tab.Screen name="Profile" component={PatientProfileScreen} .../>
```

### i18n additions — `locales/es.json` and `locales/en.json`

```json
// es.json additions under "profile":
{
  "profile": {
    "name":      "Nombre completo",
    "dob":       "Fecha de nacimiento (AAAA-MM-DD)",
    "allergies": "Alergias conocidas",
    "save":      "Guardar",
    "saved":     "Guardado ✓"
  }
}

// en.json additions under "profile":
{
  "profile": {
    "name":      "Full name",
    "dob":       "Date of birth (YYYY-MM-DD)",
    "allergies": "Known allergies",
    "save":      "Save",
    "saved":     "Saved ✓"
  }
}
```

---

## 4. Section 3 — Symptom Photo Upload

### New dependencies

```bash
npx expo install expo-image-picker expo-image-manipulator
```

### Modified: `apps/mobile/app.json`

Add plugin config under `expo.plugins`:
```json
[
  "expo-image-picker",
  {
    "cameraPermission": "MédicoYa needs camera access to attach symptom photos.",
    "microphonePermission": false,
    "photosPermission": "MédicoYa needs photo library access to attach symptom photos."
  }
]
```

### Modified: `apps/mobile/src/screens/patient/HomeScreen.tsx`

State addition:
```typescript
const [photo, setPhoto] = useState<{ uri: string } | null>(null)
```

Photo picker (shown as button below symptoms input):
```typescript
const pickPhoto = async (source: 'camera' | 'library') => {
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: 'Images' })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'Images' })
  if (!result.canceled) {
    const compressed = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1080 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    )
    setPhoto({ uri: compressed.uri })
  }
}

const showPhotoPicker = () => {
  Alert.alert(t('consultation.attach_photo'), '', [
    { text: t('consultation.photo_camera'),  onPress: () => pickPhoto('camera')  },
    { text: t('consultation.photo_library'), onPress: () => pickPhoto('library') },
    { text: t('common.cancel'), style: 'cancel' },
  ])
}
```

Thumbnail + remove button (rendered below symptoms input when `photo` is set):
```tsx
{photo
  ? <View style={styles.photoRow}>
      <Image source={{ uri: photo.uri }} style={styles.thumbnail} testID="photo-thumbnail" />
      <TouchableOpacity onPress={() => setPhoto(null)} testID="remove-photo-btn">
        <Text style={styles.removePhoto}>{t('consultation.remove_photo')}</Text>
      </TouchableOpacity>
    </View>
  : <TouchableOpacity onPress={showPhotoPicker} testID="attach-photo-btn">
      <Text style={styles.attachPhoto}>{t('consultation.attach_photo')}</Text>
    </TouchableOpacity>
}
```

Submit with photo:
```typescript
const formData = new FormData()
formData.append('symptoms_text', symptoms.trim())
if (photo) {
  formData.append('photo', {
    uri:  photo.uri,
    type: 'image/jpeg',
    name: 'symptom.jpg',
  } as any)
}
```

### i18n additions

```json
// es.json under "consultation":
{
  "attach_photo":  "Adjuntar foto",
  "photo_camera":  "Cámara",
  "photo_library": "Galería",
  "remove_photo":  "Quitar foto"
}

// en.json under "consultation":
{
  "attach_photo":  "Attach photo",
  "photo_camera":  "Camera",
  "photo_library": "Gallery",
  "remove_photo":  "Remove photo"
}
```

---

## 5. Section 4 — Railway Deploy

### New: `railway.toml` (repo root)

```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npm --workspace packages/api exec prisma migrate deploy && npm run start"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### Modified: `apps/mobile/.env.example`

```bash
# Development
EXPO_PUBLIC_API_URL=http://localhost:3000

# Production (Railway)
# EXPO_PUBLIC_API_URL=https://<your-project>.up.railway.app
```

### Manual steps (documented, not automated)

1. Create project at [railway.app](https://railway.app) → **New Project → Empty Project**
2. Add service from GitHub repo → select this monorepo
3. Add **PostgreSQL** plugin → Railway auto-provides `DATABASE_URL`
4. Set environment variables in Railway dashboard:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 32+ character random string (e.g., `openssl rand -hex 32`) |
| `TWILIO_ACCOUNT_SID` | From [Twilio Console](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | From Twilio Console |
| `TWILIO_VERIFY_SERVICE_SID` | From Twilio Console → Verify → Services |
| `CLOUDINARY_CLOUD_NAME` | From [Cloudinary Dashboard](https://cloudinary.com/console) |
| `CLOUDINARY_API_KEY` | From Cloudinary Dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary Dashboard |

5. Trigger deploy → Railway builds, runs `prisma migrate deploy`, starts server
6. Copy Railway domain (`https://<name>.up.railway.app`) → set as `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`

---

## 6. File Map

| Action | File | Change |
|--------|------|--------|
| NEW | `packages/api/src/services/PatientService.ts` | getProfile + updateProfile |
| NEW | `packages/api/src/routes/patients.ts` | GET + PUT /api/patients/me |
| NEW | `packages/api/src/routes/patients.test.ts` | 7 tests |
| MOD | `packages/api/src/app.ts` | wire /api/patients |
| NEW | `apps/mobile/src/screens/patient/PatientProfileScreen.tsx` | patient profile editor |
| NEW | `apps/mobile/src/__tests__/PatientProfileScreen.test.tsx` | profile screen tests |
| MOD | `apps/mobile/src/navigation/PatientTabs.tsx` | swap to PatientProfileScreen |
| MOD | `apps/mobile/src/screens/patient/HomeScreen.tsx` | photo picker + compress + upload |
| MOD | `apps/mobile/app.json` | expo-image-picker plugin config |
| MOD | `apps/mobile/locales/es.json` | profile.* + consultation.photo_* keys |
| MOD | `apps/mobile/locales/en.json` | profile.* + consultation.photo_* keys |
| NEW | `railway.toml` | Railway build + deploy config |
| MOD | `apps/mobile/.env.example` | add production URL comment |

---

## 7. Out of Scope

- Patient photo in profile (avatar)
- Doctor profile editing from mobile
- EAS Build / APK generation (Expo Go is sufficient for beta)
- Redis adapter for Socket.io horizontal scaling (Phase 2)
- Custom Railway domain / SSL certificate (Railway provides subdomain)
- Tigo Money payment integration (Phase 2)
