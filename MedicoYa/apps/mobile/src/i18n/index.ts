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
