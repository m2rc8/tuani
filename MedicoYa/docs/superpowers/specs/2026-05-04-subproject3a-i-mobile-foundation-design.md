# MédicoYa — Sub-proyecto 3a-i: Mobile App Foundation

**Fecha:** 2026-05-04  
**Estado:** Aprobado  
**Fase PRD:** Fase 1 MVP  
**Scope:** Expo scaffold, React Navigation shell, OTP auth, Zustand store, axios client, i18n wiring

---

## Decisiones técnicas

| Decisión | Elección | Razón |
|----------|----------|-------|
| Framework | Expo SDK 52 (managed workflow) | PRD especifica Expo managed; sin configuración nativa compleja en Fase 1 |
| Navegación | React Navigation 7 (native-stack + bottom-tabs) | Control explícito sobre el árbol de navegación por rol; más predecible que Expo Router para auth multi-rol |
| Auth state | Zustand | Mínimo boilerplate; persist middleware integrado |
| Token storage | expo-secure-store | Health app — JWT cifrado en el dispositivo |
| Non-sensitive state | @react-native-async-storage/async-storage | role, userId, language (no requieren cifrado) |
| API client | axios | PRD especifica axios; interceptores para JWT y 401 |
| i18n | i18next + react-i18next + expo-localization | PRD especifica estas librerías; detección automática de idioma del dispositivo |
| TypeScript | Strict | Consistente con monorepo |

---

## Estructura de archivos

```
apps/mobile/
├── app.json                          ← Expo config (name, slug, icon, splash)
├── package.json                      ← @medicoya/mobile workspace
├── tsconfig.json                     ← strict, path alias @/*→src/*
├── babel.config.js                   ← expo preset
├── .env                              ← EXPO_PUBLIC_API_URL=http://localhost:3000
└── src/
    ├── App.tsx                       ← entry: i18n init + NavigationContainer + RootNavigator
    ├── navigation/
    │   ├── RootNavigator.tsx         ← reads authStore.token → AuthStack | PatientTabs | DoctorTabs
    │   ├── AuthStack.tsx             ← NativeStack: LoginScreen → OtpScreen
    │   ├── PatientTabs.tsx           ← BottomTabs: Home, History, Profile
    │   └── DoctorTabs.tsx            ← BottomTabs: Queue, History, Profile
    ├── screens/
    │   ├── auth/
    │   │   ├── LoginScreen.tsx       ← phone input, POST /api/auth/send-otp
    │   │   └── OtpScreen.tsx         ← code input, POST /api/auth/verify-otp → login()
    │   ├── patient/
    │   │   ├── HomeScreen.tsx        ← placeholder ("Próximamente")
    │   │   └── HistoryScreen.tsx     ← placeholder
    │   ├── doctor/
    │   │   ├── QueueScreen.tsx       ← placeholder
    │   │   └── HistoryScreen.tsx     ← placeholder
    │   └── shared/
    │       └── ProfileScreen.tsx     ← nombre, toggle ES↔EN, logout
    ├── store/
    │   └── authStore.ts              ← Zustand: token(SecureStore) + userId/role/language(AsyncStorage)
    ├── lib/
    │   └── api.ts                    ← axios instance, request interceptor (Bearer), response interceptor (401→logout)
    └── i18n/
        ├── index.ts                  ← i18next init, expo-localization default
        ├── es.json                   ← strings en español
        └── en.json                   ← strings in English
```

---

## Auth Store (`src/store/authStore.ts`)

```typescript
interface AuthState {
  token:    string | null
  userId:   string | null
  role:     'patient' | 'doctor' | null
  language: 'es' | 'en'
  login:    (token: string, user: { id: string; role: string; preferred_language: string }) => Promise<void>
  logout:   () => Promise<void>
  setLanguage: (lang: 'es' | 'en') => Promise<void>
  hydrate:  () => Promise<void>
}
```

- `login()`: guarda token en `SecureStore`, userId + role + language en `AsyncStorage`, actualiza store y llama `i18n.changeLanguage()`
- `logout()`: limpia `SecureStore` y `AsyncStorage`, resetea store
- `setLanguage()`: actualiza `AsyncStorage` + store + llama `i18n.changeLanguage()` — efecto inmediato sin reinicio
- Hidratación al arrancar: `App.tsx` llama función `hydrate()` antes de montar `NavigationContainer` — lee SecureStore + AsyncStorage y popula el store

---

## API Client (`src/lib/api.ts`)

```typescript
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? '',
  timeout: 15_000,
})

// Request interceptor: inject Bearer token
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor: 401 → logout
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401) {
      await useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  }
)
```

---

## i18n (`src/i18n/index.ts`)

- `i18next.init()` llamado en `App.tsx` antes de renderizar nada
- Idioma inicial: `authStore.language` si existe (usuario ya autenticado), si no `expo-localization.locale` (primeros dos chars: 'es' o 'en'), fallback 'es'
- Namespaces: `common` (botones, errores genéricos), `auth` (pantallas login/otp), `profile`
- `es.json` y `en.json` contienen todas las strings — ninguna string hardcodeada en JSX

Strings mínimas para la fundación:

```json
// es.json
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

---

## Navegación (`src/navigation/RootNavigator.tsx`)

```typescript
export default function RootNavigator() {
  const { token, role } = useAuthStore()

  if (!token) return <AuthStack />
  if (role === 'doctor') return <DoctorTabs />
  return <PatientTabs />
}
```

`useAuthStore()` es reactivo — cuando `login()` o `logout()` mutan el store, RootNavigator re-renderiza automáticamente y cambia el árbol de navegación.

`AuthStack` usa `NativeStack`. Flujo: `LoginScreen` → `OtpScreen` (params: `{ phone: string }`). Tras verify-otp exitoso, `login()` muta el store y RootNavigator swaps al tabs correspondiente.

---

## OTP Login Flow

### LoginScreen
1. Input de teléfono (E.164 format, ej. `+50499000000`)
2. Botón "Enviar código" → `POST /api/auth/send-otp` con `{ phone }`
3. Si OK → `navigation.navigate('Otp', { phone })`
4. Si error → mensaje inline (no navegación)
5. Botón deshabilitado mientras loading o campo vacío

### OtpScreen
1. Input numérico 6 dígitos (filtra non-digits, máximo 6 chars)
2. Botón "Verificar" → `POST /api/auth/verify-otp` con `{ phone, code }`
3. Si OK → `authStore.login(body.token, body.user)` → RootNavigator re-renderiza
4. Si error → mensaje inline
5. Botón deshabilitado mientras loading o código < 6 dígitos
6. Botón "← Cambiar teléfono" → `navigation.goBack()`

---

## ProfileScreen (shared)

- Muestra nombre del usuario (de `authStore`)
- Toggle idioma: ES | EN → llama `authStore.setLanguage()` → UI se actualiza inmediatamente sin reinicio
- Botón "Cerrar sesión" → `authStore.logout()` → RootNavigator swaps a AuthStack

---

## Pantallas placeholder

`HomeScreen`, `HistoryScreen` (patient), `QueueScreen`, `HistoryScreen` (doctor): renderan únicamente `<Text>{t('common.coming_soon')}</Text>` centrado. Implementación real en 3a-ii y 3a-iii.

---

## Root package.json

Agregar script:
```json
"dev:mobile": "npm --workspace apps/mobile run start"
```

---

## Criterios de aceptación

- [ ] `npm run dev:mobile` arranca Expo sin errores
- [ ] Login con teléfono + OTP funciona contra API local
- [ ] Paciente ve PatientTabs, médico ve DoctorTabs tras login
- [ ] Logout limpia token y vuelve a LoginScreen
- [ ] 401 en cualquier llamada API → logout automático
- [ ] Toggle de idioma en ProfileScreen cambia strings inmediatamente (sin reiniciar)
- [ ] Idioma por defecto = idioma del dispositivo (es/en), fallback es
- [ ] Ninguna string hardcodeada en JSX (todo via `t()`)
- [ ] TypeScript compila sin errores (`npx tsc --noEmit`)
