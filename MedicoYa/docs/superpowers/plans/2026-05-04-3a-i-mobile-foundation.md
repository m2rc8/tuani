# 3a-i Mobile Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap `apps/mobile` as an Expo 52 managed workspace with OTP auth, role-based navigation (patient/doctor), Zustand auth store, axios API client, and ES/EN i18n — ready for 3a-ii (patient flow) and 3a-iii (doctor flow).

**Architecture:** `App.tsx` hydrates auth state from device storage then renders `NavigationContainer → RootNavigator`. `RootNavigator` reads `authStore.token/role` reactively and swaps between `AuthStack | PatientTabs | DoctorTabs`. JWT stored encrypted in `expo-secure-store`; non-sensitive user data in `AsyncStorage`.

**Tech Stack:** Expo SDK 52, React Navigation 7 (native-stack + bottom-tabs), Zustand 5, expo-secure-store, axios 1.x, i18next 23 + react-i18next 14, expo-localization, TypeScript strict, jest-expo + @testing-library/react-native.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/package.json` | Create | Workspace config, deps, jest preset |
| `apps/mobile/app.json` | Create | Expo config (name, slug, orientation) |
| `apps/mobile/tsconfig.json` | Create | Strict TS, `@/*` → `src/*` alias |
| `apps/mobile/babel.config.js` | Create | expo preset + module-resolver alias |
| `apps/mobile/.env` | Create | `EXPO_PUBLIC_API_URL=http://localhost:3000` |
| `apps/mobile/.env.example` | Create | Template (committed) |
| `apps/mobile/src/__tests__/setup.ts` | Create | Global jest mocks for native modules |
| `apps/mobile/src/i18n/es.json` | Create | Spanish strings |
| `apps/mobile/src/i18n/en.json` | Create | English strings |
| `apps/mobile/src/i18n/index.ts` | Create | i18next init (sync, device locale default) |
| `apps/mobile/src/__tests__/i18n.test.ts` | Create | Verify all translation keys load |
| `apps/mobile/src/store/authStore.ts` | Create | Zustand: token + userId + role + language |
| `apps/mobile/src/__tests__/authStore.test.ts` | Create | login / logout / setLanguage / hydrate |
| `apps/mobile/src/lib/api.ts` | Create | axios instance + Bearer interceptor + 401 logout |
| `apps/mobile/src/__tests__/api.test.ts` | Create | Interceptor behavior |
| `apps/mobile/src/screens/patient/HomeScreen.tsx` | Create | Placeholder (`coming_soon`) |
| `apps/mobile/src/screens/patient/HistoryScreen.tsx` | Create | Placeholder |
| `apps/mobile/src/screens/doctor/QueueScreen.tsx` | Create | Placeholder |
| `apps/mobile/src/screens/doctor/HistoryScreen.tsx` | Create | Placeholder |
| `apps/mobile/src/screens/shared/ProfileScreen.tsx` | Create | Language toggle + logout |
| `apps/mobile/src/screens/auth/LoginScreen.tsx` | Create | Phone input → POST send-otp → navigate Otp |
| `apps/mobile/src/screens/auth/OtpScreen.tsx` | Create | Code input → POST verify-otp → authStore.login() |
| `apps/mobile/src/__tests__/LoginScreen.test.tsx` | Create | Button states + OTP navigation flow |
| `apps/mobile/src/__tests__/OtpScreen.test.tsx` | Create | Button states + digit filter + login call |
| `apps/mobile/src/navigation/AuthStack.tsx` | Create | NativeStack: Login → Otp |
| `apps/mobile/src/navigation/PatientTabs.tsx` | Create | BottomTabs: Home, History, Profile |
| `apps/mobile/src/navigation/DoctorTabs.tsx` | Create | BottomTabs: Queue, History, Profile |
| `apps/mobile/src/navigation/RootNavigator.tsx` | Create | Reads authStore → swaps navigator |
| `apps/mobile/src/App.tsx` | Create | Entry: hydrate + i18n + NavigationContainer |
| `package.json` (root) | Modify | Add `dev:mobile` script |
| `.gitignore` (root) | Modify | Add `apps/mobile/.env` |

---

## Task 1: Expo Scaffold

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/.env`
- Create: `apps/mobile/.env.example`
- Create: `apps/mobile/src/__tests__/setup.ts`
- Modify: `.gitignore` (root)

No test file — verified by `npx tsc --noEmit` after scaffold.

- [ ] **Step 1: Create `apps/mobile/package.json`**

```json
{
  "name": "@medicoya/mobile",
  "version": "1.0.0",
  "private": true,
  "main": "src/App.tsx",
  "scripts": {
    "start": "expo start",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "react": "18.3.2",
    "react-native": "0.76.5",
    "@react-navigation/native": "^7.0.0",
    "@react-navigation/native-stack": "^7.0.0",
    "@react-navigation/bottom-tabs": "^7.0.0",
    "zustand": "^5.0.0",
    "expo-secure-store": "~14.0.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "axios": "^1.7.0",
    "i18next": "^23.0.0",
    "react-i18next": "^14.0.0",
    "expo-localization": "~15.0.0",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.3.0",
    "typescript": "^5.3.0",
    "jest-expo": "~52.0.0",
    "@testing-library/react-native": "^12.4.0",
    "axios-mock-adapter": "^2.0.0",
    "babel-plugin-module-resolver": "^5.0.0"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFiles": ["./src/__tests__/setup.ts"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|zustand|i18next|react-i18next)"
    ]
  }
}
```

- [ ] **Step 2: Create `apps/mobile/app.json`**

```json
{
  "expo": {
    "name": "MédicoYa",
    "slug": "medicoya",
    "version": "1.0.0",
    "orientation": "portrait",
    "platforms": ["ios", "android"],
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.medicoya.app"
    },
    "android": {
      "package": "com.medicoya.app"
    }
  }
}
```

- [ ] **Step 3: Create `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 4: Create `apps/mobile/babel.config.js`**

```javascript
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        root: ['.'],
        alias: { '@': './src' },
      }],
    ],
  }
}
```

- [ ] **Step 5: Create `apps/mobile/.env` and `apps/mobile/.env.example`**

`.env`:
```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

`.env.example`:
```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 6: Create `apps/mobile/src/__tests__/setup.ts`**

```typescript
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-HN' }],
}))
```

- [ ] **Step 7: Add `apps/mobile/.env` to root `.gitignore`**

Append this line to `.gitignore` at the repo root (the file already exists):
```
apps/mobile/.env
```

- [ ] **Step 8: Install dependencies**

Run from the monorepo root (not inside `apps/mobile/`):
```bash
npm install
```

Expected: installs `@medicoya/mobile` workspace dependencies, no errors.

- [ ] **Step 9: Verify TypeScript config resolves**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -5
```

Expected: error about no input files (that's fine — no `.ts` files yet). Must NOT error on "cannot find tsconfig" or "expo/tsconfig.base not found".

If expo/tsconfig.base is missing: run `npm install` again from root to ensure expo is installed in the workspace.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/tsconfig.json \
        apps/mobile/babel.config.js apps/mobile/.env.example \
        apps/mobile/src/__tests__/setup.ts .gitignore
git commit -m "feat(mobile): expo 52 workspace scaffold — package.json, tsconfig, babel, jest"
```

---

## Task 2: i18n Translations + Init

**Files:**
- Create: `apps/mobile/src/i18n/es.json`
- Create: `apps/mobile/src/i18n/en.json`
- Create: `apps/mobile/src/i18n/index.ts`
- Create: `apps/mobile/src/__tests__/i18n.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/mobile/src/__tests__/i18n.test.ts`:

```typescript
describe('i18n translations', () => {
  it('loads Spanish auth keys', async () => {
    const i18n = (await import('../i18n')).default
    await i18n.changeLanguage('es')
    expect(i18n.t('auth.phone_label')).toBe('Número de teléfono')
    expect(i18n.t('auth.send_code')).toBe('Enviar código')
    expect(i18n.t('auth.code_label')).toBe('Código OTP')
    expect(i18n.t('auth.verify')).toBe('Verificar')
    expect(i18n.t('auth.change_phone')).toBe('← Cambiar teléfono')
    expect(i18n.t('auth.error_send')).toBe('Error al enviar código')
    expect(i18n.t('auth.error_verify')).toBe('Código inválido')
  })

  it('loads Spanish profile + common keys', async () => {
    const i18n = (await import('../i18n')).default
    await i18n.changeLanguage('es')
    expect(i18n.t('profile.title')).toBe('Perfil')
    expect(i18n.t('profile.language')).toBe('Idioma')
    expect(i18n.t('profile.logout')).toBe('Cerrar sesión')
    expect(i18n.t('common.coming_soon')).toBe('Próximamente')
    expect(i18n.t('common.error_generic')).toBe('Algo salió mal')
  })

  it('loads English keys', async () => {
    const i18n = (await import('../i18n')).default
    await i18n.changeLanguage('en')
    expect(i18n.t('auth.phone_label')).toBe('Phone number')
    expect(i18n.t('auth.send_code')).toBe('Send code')
    expect(i18n.t('auth.verify')).toBe('Verify')
    expect(i18n.t('profile.logout')).toBe('Sign out')
    expect(i18n.t('common.coming_soon')).toBe('Coming soon')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm --workspace apps/mobile run test -- --testPathPattern=i18n
```

Expected: FAIL — `Cannot find module '../i18n'`

- [ ] **Step 3: Create `apps/mobile/src/i18n/es.json`**

```json
{
  "auth": {
    "phone_label": "Número de teléfono",
    "send_code": "Enviar código",
    "sending": "Enviando...",
    "code_label": "Código OTP",
    "verify": "Verificar",
    "verifying": "Verificando...",
    "change_phone": "← Cambiar teléfono",
    "error_send": "Error al enviar código",
    "error_verify": "Código inválido"
  },
  "profile": {
    "title": "Perfil",
    "language": "Idioma",
    "logout": "Cerrar sesión"
  },
  "common": {
    "coming_soon": "Próximamente",
    "error_generic": "Algo salió mal"
  }
}
```

- [ ] **Step 4: Create `apps/mobile/src/i18n/en.json`**

```json
{
  "auth": {
    "phone_label": "Phone number",
    "send_code": "Send code",
    "sending": "Sending...",
    "code_label": "OTP code",
    "verify": "Verify",
    "verifying": "Verifying...",
    "change_phone": "← Change phone",
    "error_send": "Failed to send code",
    "error_verify": "Invalid code"
  },
  "profile": {
    "title": "Profile",
    "language": "Language",
    "logout": "Sign out"
  },
  "common": {
    "coming_soon": "Coming soon",
    "error_generic": "Something went wrong"
  }
}
```

- [ ] **Step 5: Create `apps/mobile/src/i18n/index.ts`**

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'
import es from './es.json'
import en from './en.json'

const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'es'
const defaultLang: 'es' | 'en' = deviceLang.startsWith('es') ? 'es' : 'en'

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: defaultLang,
    fallbackLng: 'es',
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    interpolation: { escapeValue: false },
    initImmediate: false,
  })
}

export default i18n
```

- [ ] **Step 6: Run — expect PASS**

```bash
npm --workspace apps/mobile run test -- --testPathPattern=i18n
```

Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/i18n/ apps/mobile/src/__tests__/i18n.test.ts
git commit -m "feat(mobile): i18n setup — es/en translations, i18next init"
```

---

## Task 3: Auth Store

**Files:**
- Create: `apps/mobile/src/store/authStore.ts`
- Create: `apps/mobile/src/__tests__/authStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/__tests__/authStore.test.ts`:

```typescript
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Mock i18n before importing authStore (authStore calls i18n.changeLanguage)
jest.mock('../i18n', () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn().mockResolvedValue(undefined) },
}))

import i18n from '../i18n'
import { useAuthStore } from '../store/authStore'

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>

beforeEach(async () => {
  useAuthStore.setState({ token: null, userId: null, role: null, language: 'es' })
  jest.clearAllMocks()
  await AsyncStorage.clear()
})

describe('authStore.login', () => {
  it('stores token in SecureStore', async () => {
    await useAuthStore.getState().login('tok123', {
      id: 'u1', role: 'patient', preferred_language: 'es',
    })
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'tok123')
  })

  it('stores user JSON in AsyncStorage', async () => {
    await useAuthStore.getState().login('tok123', {
      id: 'u1', role: 'patient', preferred_language: 'es',
    })
    const raw = await AsyncStorage.getItem('auth_user')
    expect(JSON.parse(raw!)).toEqual({ userId: 'u1', role: 'patient', language: 'es' })
  })

  it('updates store state', async () => {
    await useAuthStore.getState().login('tok123', {
      id: 'u1', role: 'doctor', preferred_language: 'en',
    })
    const { token, userId, role, language } = useAuthStore.getState()
    expect(token).toBe('tok123')
    expect(userId).toBe('u1')
    expect(role).toBe('doctor')
    expect(language).toBe('en')
  })

  it('calls i18n.changeLanguage with resolved language', async () => {
    await useAuthStore.getState().login('tok123', {
      id: 'u1', role: 'patient', preferred_language: 'en',
    })
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en')
  })

  it('defaults unknown preferred_language to es', async () => {
    await useAuthStore.getState().login('tok123', {
      id: 'u1', role: 'patient', preferred_language: 'fr',
    })
    expect(useAuthStore.getState().language).toBe('es')
  })
})

describe('authStore.logout', () => {
  beforeEach(async () => {
    await useAuthStore.getState().login('tok', {
      id: 'u1', role: 'patient', preferred_language: 'es',
    })
    jest.clearAllMocks()
  })

  it('deletes token from SecureStore', async () => {
    await useAuthStore.getState().logout()
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token')
  })

  it('removes user from AsyncStorage', async () => {
    await useAuthStore.getState().logout()
    expect(await AsyncStorage.getItem('auth_user')).toBeNull()
  })

  it('resets state to null', async () => {
    await useAuthStore.getState().logout()
    const { token, userId, role } = useAuthStore.getState()
    expect(token).toBeNull()
    expect(userId).toBeNull()
    expect(role).toBeNull()
  })
})

describe('authStore.setLanguage', () => {
  it('updates language in store', async () => {
    await useAuthStore.getState().setLanguage('en')
    expect(useAuthStore.getState().language).toBe('en')
  })

  it('calls i18n.changeLanguage', async () => {
    await useAuthStore.getState().setLanguage('en')
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en')
  })

  it('persists language in AsyncStorage when user exists', async () => {
    await AsyncStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 'u1', role: 'patient', language: 'es' }),
    )
    await useAuthStore.getState().setLanguage('en')
    const raw = await AsyncStorage.getItem('auth_user')
    expect(JSON.parse(raw!).language).toBe('en')
  })
})

describe('authStore.hydrate', () => {
  it('restores token and user from storage', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce('saved_token')
    await AsyncStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 'u2', role: 'doctor', language: 'en' }),
    )
    await useAuthStore.getState().hydrate()
    const { token, userId, role, language } = useAuthStore.getState()
    expect(token).toBe('saved_token')
    expect(userId).toBe('u2')
    expect(role).toBe('doctor')
    expect(language).toBe('en')
  })

  it('calls i18n.changeLanguage with stored language', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce('tok')
    await AsyncStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 'u1', role: 'patient', language: 'en' }),
    )
    await useAuthStore.getState().hydrate()
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en')
  })

  it('does nothing when no stored token', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce(null)
    await useAuthStore.getState().hydrate()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('does nothing when token exists but user data missing', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce('tok')
    // AsyncStorage is clear — no auth_user
    await useAuthStore.getState().hydrate()
    expect(useAuthStore.getState().token).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm --workspace apps/mobile run test -- --testPathPattern=authStore
```

Expected: FAIL — `Cannot find module '../store/authStore'`

- [ ] **Step 3: Create `apps/mobile/src/store/authStore.ts`**

```typescript
import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import i18n from '../i18n'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

interface StoredUser {
  userId: string
  role: 'patient' | 'doctor'
  language: 'es' | 'en'
}

interface AuthState {
  token: string | null
  userId: string | null
  role: 'patient' | 'doctor' | null
  language: 'es' | 'en'
  login: (token: string, user: { id: string; role: string; preferred_language: string }) => Promise<void>
  logout: () => Promise<void>
  setLanguage: (lang: 'es' | 'en') => Promise<void>
  hydrate: () => Promise<void>
}

function resolveLang(raw: string): 'es' | 'en' {
  return raw === 'en' ? 'en' : 'es'
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  role: null,
  language: 'es',

  login: async (token, user) => {
    const language = resolveLang(user.preferred_language)
    const stored: StoredUser = { userId: user.id, role: user.role as 'patient' | 'doctor', language }
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(stored))
    set({ token, userId: user.id, role: stored.role, language })
    await i18n.changeLanguage(language)
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    await AsyncStorage.removeItem(USER_KEY)
    set({ token: null, userId: null, role: null, language: 'es' })
  },

  setLanguage: async (lang) => {
    const raw = await AsyncStorage.getItem(USER_KEY)
    if (raw) {
      const parsed: StoredUser = JSON.parse(raw)
      await AsyncStorage.setItem(USER_KEY, JSON.stringify({ ...parsed, language: lang }))
    }
    set({ language: lang })
    await i18n.changeLanguage(lang)
  },

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY)
    const raw = await AsyncStorage.getItem(USER_KEY)
    if (!token || !raw) return
    const { userId, role, language }: StoredUser = JSON.parse(raw)
    set({ token, userId, role, language })
    await i18n.changeLanguage(language)
  },
}))
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm --workspace apps/mobile run test -- --testPathPattern=authStore
```

Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/store/authStore.ts apps/mobile/src/__tests__/authStore.test.ts
git commit -m "feat(mobile): auth store — Zustand login/logout/setLanguage/hydrate with SecureStore"
```

---

## Task 4: API Client

**Files:**
- Create: `apps/mobile/src/lib/api.ts`
- Create: `apps/mobile/src/__tests__/api.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/__tests__/api.test.ts`:

```typescript
import AxiosMockAdapter from 'axios-mock-adapter'

jest.mock('../i18n', () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

let mock: AxiosMockAdapter

beforeEach(() => {
  mock = new AxiosMockAdapter(api)
  useAuthStore.setState({ token: null, userId: null, role: null, language: 'es' })
  jest.clearAllMocks()
})

afterEach(() => {
  mock.restore()
})

describe('api request interceptor', () => {
  it('makes request without Authorization when no token', async () => {
    mock.onGet('/test').reply(200, {})
    const res = await api.get('/test')
    expect(res.config.headers?.Authorization).toBeUndefined()
  })

  it('injects Bearer token when token exists in store', async () => {
    useAuthStore.setState({ token: 'my-jwt', userId: null, role: null, language: 'es' })
    mock.onGet('/test').reply(200, {})
    const res = await api.get('/test')
    expect(res.config.headers?.Authorization).toBe('Bearer my-jwt')
  })
})

describe('api response interceptor', () => {
  it('passes through successful responses', async () => {
    mock.onGet('/test').reply(200, { ok: true })
    const res = await api.get('/test')
    expect(res.data).toEqual({ ok: true })
  })

  it('calls logout and rejects on 401', async () => {
    useAuthStore.setState({ token: 'expired', userId: 'u1', role: 'patient', language: 'es' })
    mock.onGet('/secure').reply(401)
    await expect(api.get('/secure')).rejects.toBeDefined()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('rejects non-401 errors without logging out', async () => {
    useAuthStore.setState({ token: 'valid', userId: 'u1', role: 'patient', language: 'es' })
    mock.onGet('/bad').reply(500)
    await expect(api.get('/bad')).rejects.toBeDefined()
    expect(useAuthStore.getState().token).toBe('valid')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm --workspace apps/mobile run test -- --testPathPattern=api.test
```

Expected: FAIL — `Cannot find module '../lib/api'`

- [ ] **Step 3: Create `apps/mobile/src/lib/api.ts`**

```typescript
import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? '',
  timeout: 15_000,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  },
)

export default api
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm --workspace apps/mobile run test -- --testPathPattern=api.test
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/api.ts apps/mobile/src/__tests__/api.test.ts
git commit -m "feat(mobile): axios client — Bearer token interceptor, 401 auto-logout"
```

---

## Task 5: All Screens (Placeholders + Auth Screen Stubs)

**Files:**
- Create: `apps/mobile/src/screens/patient/HomeScreen.tsx`
- Create: `apps/mobile/src/screens/patient/HistoryScreen.tsx`
- Create: `apps/mobile/src/screens/doctor/QueueScreen.tsx`
- Create: `apps/mobile/src/screens/doctor/HistoryScreen.tsx`
- Create: `apps/mobile/src/screens/shared/ProfileScreen.tsx`
- Create: `apps/mobile/src/screens/auth/LoginScreen.tsx` (stub — replaced in Task 7)
- Create: `apps/mobile/src/screens/auth/OtpScreen.tsx` (stub — replaced in Task 7)

No test file. Verified by TypeScript compile check.

- [ ] **Step 1: Create placeholder screens**

`apps/mobile/src/screens/patient/HomeScreen.tsx`:
```tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'

export default function HomeScreen() {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <Text>{t('common.coming_soon')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
```

`apps/mobile/src/screens/patient/HistoryScreen.tsx`:
```tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'

export default function PatientHistoryScreen() {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <Text>{t('common.coming_soon')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
```

`apps/mobile/src/screens/doctor/QueueScreen.tsx`:
```tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'

export default function QueueScreen() {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <Text>{t('common.coming_soon')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
```

`apps/mobile/src/screens/doctor/HistoryScreen.tsx`:
```tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'

export default function DoctorHistoryScreen() {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <Text>{t('common.coming_soon')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
```

- [ ] **Step 2: Create ProfileScreen**

`apps/mobile/src/screens/shared/ProfileScreen.tsx`:
```tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/authStore'

export default function ProfileScreen() {
  const { t } = useTranslation()
  const language = useAuthStore((s) => s.language)
  const setLanguage = useAuthStore((s) => s.setLanguage)
  const logout = useAuthStore((s) => s.logout)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      <Text style={styles.label}>{t('profile.language')}</Text>
      <View style={styles.langRow}>
        <TouchableOpacity
          onPress={() => setLanguage('es')}
          style={[styles.langBtn, language === 'es' && styles.langBtnActive]}
          testID="lang-es"
        >
          <Text style={language === 'es' ? styles.langTextActive : styles.langText}>ES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setLanguage('en')}
          style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
          testID="lang-en"
        >
          <Text style={language === 'en' ? styles.langTextActive : styles.langText}>EN</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={logout} style={styles.logoutBtn} testID="logout-btn">
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  label: { fontSize: 16, marginBottom: 8 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  langBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6,
  },
  langBtnActive: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  langText: { color: '#64748B', fontWeight: '500' },
  langTextActive: { color: '#3B82F6', fontWeight: '600' },
  logoutBtn: {
    marginTop: 'auto', padding: 14, backgroundColor: '#EF4444',
    borderRadius: 8, alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 3: Create auth screen stubs (replaced in Task 7)**

Stubs use `any` props — no import from navigation (which doesn't exist yet). Task 6 imports these by default export only.

`apps/mobile/src/screens/auth/LoginScreen.tsx`:
```tsx
import React from 'react'
import { View, Text } from 'react-native'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LoginScreen(_props: any) {
  return <View><Text>Login</Text></View>
}
```

`apps/mobile/src/screens/auth/OtpScreen.tsx`:
```tsx
import React from 'react'
import { View, Text } from 'react-native'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function OtpScreen(_props: any) {
  return <View><Text>OTP</Text></View>
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/
git commit -m "feat(mobile): all screen stubs — placeholders + auth screen shells"
```

---

## Task 6: Navigation Shell

**Files:**
- Create: `apps/mobile/src/navigation/AuthStack.tsx`
- Create: `apps/mobile/src/navigation/PatientTabs.tsx`
- Create: `apps/mobile/src/navigation/DoctorTabs.tsx`
- Create: `apps/mobile/src/navigation/RootNavigator.tsx`

No test file. Verified by `npx tsc --noEmit`.

- [ ] **Step 1: Create `apps/mobile/src/navigation/AuthStack.tsx`**

```tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import LoginScreen from '../screens/auth/LoginScreen'
import OtpScreen from '../screens/auth/OtpScreen'

export type AuthStackParamList = {
  Login: undefined
  Otp: { phone: string }
}

const Stack = createNativeStackNavigator<AuthStackParamList>()

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 2: Create `apps/mobile/src/navigation/PatientTabs.tsx`**

```tsx
import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import HomeScreen from '../screens/patient/HomeScreen'
import PatientHistoryScreen from '../screens/patient/HistoryScreen'
import ProfileScreen from '../screens/shared/ProfileScreen'

type PatientTabsParamList = {
  Home: undefined
  History: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<PatientTabsParamList>()

export default function PatientTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="History" component={PatientHistoryScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  )
}
```

- [ ] **Step 3: Create `apps/mobile/src/navigation/DoctorTabs.tsx`**

```tsx
import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import QueueScreen from '../screens/doctor/QueueScreen'
import DoctorHistoryScreen from '../screens/doctor/HistoryScreen'
import ProfileScreen from '../screens/shared/ProfileScreen'

type DoctorTabsParamList = {
  Queue: undefined
  History: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<DoctorTabsParamList>()

export default function DoctorTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Queue" component={QueueScreen} options={{ title: 'Cola' }} />
      <Tab.Screen name="History" component={DoctorHistoryScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  )
}
```

- [ ] **Step 4: Create `apps/mobile/src/navigation/RootNavigator.tsx`**

```tsx
import React from 'react'
import { useAuthStore } from '../store/authStore'
import AuthStack from './AuthStack'
import PatientTabs from './PatientTabs'
import DoctorTabs from './DoctorTabs'

export default function RootNavigator() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.role)

  if (!token) return <AuthStack />
  if (role === 'doctor') return <DoctorTabs />
  return <PatientTabs />
}
```

- [ ] **Step 5: Run TypeScript compile check**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors. If errors about missing peer deps or types, run `npm install` from the monorepo root first.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/navigation/
git commit -m "feat(mobile): navigation shell — AuthStack, PatientTabs, DoctorTabs, RootNavigator"
```

---

## Task 7: Auth Screens — LoginScreen + OtpScreen

**Files:**
- Modify: `apps/mobile/src/screens/auth/LoginScreen.tsx` (replace stub with full impl)
- Modify: `apps/mobile/src/screens/auth/OtpScreen.tsx` (replace stub with full impl)
- Create: `apps/mobile/src/__tests__/LoginScreen.test.tsx`
- Create: `apps/mobile/src/__tests__/OtpScreen.test.tsx`

- [ ] **Step 1: Write failing LoginScreen tests**

Create `apps/mobile/src/__tests__/LoginScreen.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import LoginScreen from '../screens/auth/LoginScreen'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import api from '../lib/api'
const mockApi = api as jest.Mocked<typeof api>

const mockNavigate = jest.fn()
const navigation = { navigate: mockNavigate } as any
const route = {} as any

beforeEach(() => jest.clearAllMocks())

describe('LoginScreen', () => {
  it('send button is disabled when phone is empty', () => {
    const { getByTestId } = render(<LoginScreen navigation={navigation} route={route} />)
    expect(getByTestId('send-btn').props.disabled).toBe(true)
  })

  it('send button is enabled when phone has value', () => {
    const { getByTestId } = render(<LoginScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('phone-input'), '+50499000000')
    expect(getByTestId('send-btn').props.disabled).toBeFalsy()
  })

  it('navigates to Otp with phone on success', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} })
    const { getByTestId } = render(<LoginScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('phone-input'), '+50499000000')
    fireEvent.press(getByTestId('send-btn'))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('Otp', { phone: '+50499000000' }),
    )
  })

  it('shows error message on API failure', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('network'))
    const { getByTestId, findByText } = render(
      <LoginScreen navigation={navigation} route={route} />,
    )
    fireEvent.changeText(getByTestId('phone-input'), '+50499000000')
    fireEvent.press(getByTestId('send-btn'))
    await findByText('auth.error_send')
  })
})
```

- [ ] **Step 2: Run LoginScreen tests — expect FAIL**

```bash
npm --workspace apps/mobile run test -- --testPathPattern=LoginScreen
```

Expected: FAIL — the stub renders `<Text>Login</Text>` with no testIDs.

- [ ] **Step 3: Replace `apps/mobile/src/screens/auth/LoginScreen.tsx` with full implementation**

```tsx
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import api from '../../lib/api'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export default function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/send-otp', { phone })
      navigation.navigate('Otp', { phone })
    } catch {
      setError(t('auth.error_send'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('auth.phone_label')}</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="+50499000000"
        keyboardType="phone-pad"
        autoComplete="tel"
        style={styles.input}
        testID="phone-input"
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        onPress={handleSend}
        disabled={!phone.trim() || loading}
        style={[styles.btn, (!phone.trim() || loading) && styles.btnDisabled]}
        testID="send-btn"
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{t('auth.send_code')}</Text>}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  label: { fontSize: 16, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
    padding: 12, fontSize: 16, marginBottom: 8,
  },
  btn: {
    backgroundColor: '#3B82F6', padding: 14,
    borderRadius: 8, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#EF4444', marginBottom: 4 },
})
```

- [ ] **Step 4: Run LoginScreen tests — expect PASS**

```bash
npm --workspace apps/mobile run test -- --testPathPattern=LoginScreen
```

Expected: 4 tests pass.

- [ ] **Step 5: Write failing OtpScreen tests**

Create `apps/mobile/src/__tests__/OtpScreen.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import OtpScreen from '../screens/auth/OtpScreen'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

jest.mock('../i18n', () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
const mockApi = api as jest.Mocked<typeof api>

const mockGoBack = jest.fn()
const navigation = { goBack: mockGoBack } as any
const route = { params: { phone: '+50499000000' } } as any

beforeEach(async () => {
  jest.clearAllMocks()
  useAuthStore.setState({ token: null, userId: null, role: null, language: 'es' })
})

describe('OtpScreen', () => {
  it('verify button is disabled when code has fewer than 6 digits', () => {
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('code-input'), '123')
    expect(getByTestId('verify-btn').props.disabled).toBe(true)
  })

  it('verify button is enabled when code is exactly 6 digits', () => {
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('code-input'), '123456')
    expect(getByTestId('verify-btn').props.disabled).toBeFalsy()
  })

  it('strips non-digit characters from input', () => {
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('code-input'), 'abc123def')
    expect(getByTestId('code-input').props.value).toBe('123')
  })

  it('truncates input to 6 digits', () => {
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('code-input'), '1234567890')
    expect(getByTestId('code-input').props.value).toBe('123456')
  })

  it('calls authStore.login with token and user on success', async () => {
    mockApi.post.mockResolvedValueOnce({
      data: {
        token: 'jwt-tok',
        user: { id: 'u1', role: 'patient', preferred_language: 'es' },
      },
    })
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('code-input'), '123456')
    fireEvent.press(getByTestId('verify-btn'))
    await waitFor(() => expect(useAuthStore.getState().token).toBe('jwt-tok'))
  })

  it('shows error message on API failure', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('bad code'))
    const { getByTestId, findByText } = render(
      <OtpScreen navigation={navigation} route={route} />,
    )
    fireEvent.changeText(getByTestId('code-input'), '123456')
    fireEvent.press(getByTestId('verify-btn'))
    await findByText('auth.error_verify')
  })

  it('calls navigation.goBack when change phone pressed', () => {
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.press(getByTestId('back-btn'))
    expect(mockGoBack).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run OtpScreen tests — expect FAIL**

```bash
npm --workspace apps/mobile run test -- --testPathPattern=OtpScreen
```

Expected: FAIL — stub renders `<Text>OTP</Text>` with no testIDs.

- [ ] **Step 7: Replace `apps/mobile/src/screens/auth/OtpScreen.tsx` with full implementation**

```tsx
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/AuthStack'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>

export default function OtpScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const { phone } = route.params
  const login = useAuthStore((s) => s.login)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCodeChange = (text: string) => {
    setCode(text.replace(/\D/g, '').slice(0, 6))
  }

  const handleVerify = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<{
        token: string
        user: { id: string; role: string; preferred_language: string }
      }>('/api/auth/verify-otp', { phone, code })
      await login(data.token, data.user)
    } catch {
      setError(t('auth.error_verify'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('auth.code_label')}</Text>
      <TextInput
        value={code}
        onChangeText={handleCodeChange}
        keyboardType="number-pad"
        style={styles.input}
        testID="code-input"
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        onPress={handleVerify}
        disabled={code.length < 6 || loading}
        style={[styles.btn, (code.length < 6 || loading) && styles.btnDisabled]}
        testID="verify-btn"
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{t('auth.verify')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()} testID="back-btn">
        <Text style={styles.back}>{t('auth.change_phone')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  label: { fontSize: 16, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8,
    padding: 12, fontSize: 28, textAlign: 'center', letterSpacing: 8,
    marginBottom: 8,
  },
  btn: {
    backgroundColor: '#3B82F6', padding: 14,
    borderRadius: 8, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#EF4444', marginBottom: 4 },
  back: { color: '#3B82F6', textAlign: 'center', marginTop: 16, fontSize: 14 },
})
```

- [ ] **Step 8: Run OtpScreen tests — expect PASS**

```bash
npm --workspace apps/mobile run test -- --testPathPattern=OtpScreen
```

Expected: 6 tests pass.

- [ ] **Step 9: Run all tests**

```bash
npm --workspace apps/mobile run test
```

Expected: all tests pass (i18n: 3, authStore: 11, api: 5, LoginScreen: 4, OtpScreen: 6 = 29 total).

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/src/screens/auth/ apps/mobile/src/__tests__/LoginScreen.test.tsx \
        apps/mobile/src/__tests__/OtpScreen.test.tsx
git commit -m "feat(mobile): LoginScreen + OtpScreen — OTP auth flow with validation"
```

---

## Task 8: App Entry Point + Root Package Script

**Files:**
- Create: `apps/mobile/src/App.tsx`
- Modify: `package.json` (root) — add `dev:mobile` script

- [ ] **Step 1: Create `apps/mobile/src/App.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import './i18n'
import i18n from './i18n'
import { useAuthStore } from './store/authStore'
import RootNavigator from './navigation/RootNavigator'
import { registerRootComponent } from 'expo'

function App() {
  const [ready, setReady] = useState(false)
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    async function init() {
      await hydrate()
      await i18n.changeLanguage(useAuthStore.getState().language)
      setReady(true)
    }
    init()
  }, [hydrate])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

registerRootComponent(App)
export default App
```

- [ ] **Step 2: Run TypeScript compile check**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Add `dev:mobile` script to root `package.json`**

In the root `package.json` (at the monorepo root, not `apps/mobile/`), add `"dev:mobile"` to the `"scripts"` object:

Current scripts section:
```json
"scripts": {
  "dev:api":    "npm --workspace packages/api run dev",
  "test":       "npm --workspace packages/api run test",
  "build:admin": "npm --workspace apps/admin run build",
  "build:api":   "npm --workspace packages/api run build",
  "build":       "npm run build:admin && npm run build:api",
  "start":       "npm --workspace packages/api run start"
}
```

Updated scripts section:
```json
"scripts": {
  "dev:api":    "npm --workspace packages/api run dev",
  "dev:mobile": "npm --workspace apps/mobile run start",
  "test":       "npm --workspace packages/api run test",
  "build:admin": "npm --workspace apps/admin run build",
  "build:api":   "npm --workspace packages/api run build",
  "build":       "npm run build:admin && npm run build:api",
  "start":       "npm --workspace packages/api run start"
}
```

- [ ] **Step 4: Run all tests one final time**

```bash
npm --workspace apps/mobile run test
```

Expected: 29 tests pass, 0 failures.

- [ ] **Step 5: Verify `dev:mobile` script exists in root**

```bash
node -e "const p = require('./package.json'); console.log(p.scripts['dev:mobile'])"
```

Expected: `npm --workspace apps/mobile run start`

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/App.tsx package.json
git commit -m "feat(mobile): App.tsx entry point — hydrate + i18n + NavigationContainer; add dev:mobile script"
```

---

## Acceptance Criteria Checklist

After all 8 tasks complete, verify against the spec:

- [ ] `npm run dev:mobile` starts Expo without errors (requires Expo Go or simulator)
- [ ] Login with phone + OTP works against local API (`npm run dev:api` running in parallel)
- [ ] Patient user → sees PatientTabs; doctor user → sees DoctorTabs after login
- [ ] Logout clears token and returns to LoginScreen
- [ ] Any API call returning 401 triggers automatic logout
- [ ] Language toggle on ProfileScreen changes all strings immediately without restart
- [ ] Default language = device language (es/en), fallback es
- [ ] `npx tsc --noEmit` in `apps/mobile/` passes with 0 errors
- [ ] `npm --workspace apps/mobile run test` passes: 29 tests, 0 failures
