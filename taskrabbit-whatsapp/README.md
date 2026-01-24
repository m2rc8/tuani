# TaskRabbit WhatsApp - Plataforma de Servicios

Plataforma completa de servicios tipo TaskRabbit donde el 100% de la interacción ocurre a través de WhatsApp, utilizando Node.js, Twilio WhatsApp Business API, OpenAI para procesamiento de lenguaje natural, y Stripe/MercadoPago para pagos.

## 🎯 Características Principales

- ✅ **Gestión de dos tipos de usuarios**: Clientes y Prestadores
- ✅ **Interacción 100% vía WhatsApp**: Sin necesidad de apps móviles
- ✅ **NLP con OpenAI**: Detección inteligente de categorías de servicio
- ✅ **Búsqueda geolocalizada**: Encuentra prestadores cercanos usando Google Maps
- ✅ **Sistema de pagos integrado**: Stripe y MercadoPago
- ✅ **Calificaciones y reseñas**: Sistema de reputación para prestadores
- ✅ **Notificaciones en tiempo real**: Webhooks para actualizaciones instantáneas

## 📋 Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Instalación](#instalación)
3. [Configuración](#configuración)
4. [Uso](#uso)
5. [Flujos de Trabajo](#flujos-de-trabajo)
6. [API Reference](#api-reference)
7. [Deployment](#deployment)

## 🏗️ Arquitectura

```
┌─────────────────┐
│    WhatsApp     │
│     (Cliente)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      Twilio WhatsApp API            │
│    (Webhook POST /whatsapp)         │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Node.js/Express Backend           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  WhatsApp Controller        │   │
│  │  - Procesa mensajes         │   │
│  │  - Maneja estados           │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │  Conversation Manager       │   │
│  │  - Gestiona estados         │   │
│  │  - Historial de mensajes    │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │  OpenAI Service             │   │
│  │  - Análisis de intención    │   │
│  │  - Extracción de categoría  │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │  Providers Service          │   │
│  │  - Búsqueda geolocalizada   │   │
│  │  - Notificaciones           │   │
│  └──────────┬──────────────────┘   │
│             │                       │
│  ┌──────────▼──────────────────┐   │
│  │  Payment Service            │   │
│  │  - Stripe/MercadoPago       │   │
│  │  - Reembolsos               │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      MongoDB Database               │
│  - Users                            │
│  - Tickets                          │
│  - Conversations                    │
└─────────────────────────────────────┘
```

## 📦 Instalación

### Prerequisitos

- Node.js >= 16.x
- MongoDB >= 5.x
- Cuenta de Twilio (WhatsApp Business API)
- Cuenta de OpenAI (API Key)
- Cuenta de Google Cloud (Maps API)
- Cuenta de Stripe o MercadoPago

### Pasos de Instalación

1. **Clonar el repositorio**

```bash
git clone https://github.com/tu-usuario/taskrabbit-whatsapp.git
cd taskrabbit-whatsapp
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```env
# Server
PORT=3000
NODE_ENV=development

# Twilio WhatsApp
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google Maps
GOOGLE_MAPS_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# MongoDB
MONGODB_URI=mongodb://localhost:27017/taskrabbit-whatsapp
```

4. **Crear estructura de carpetas**

```bash
mkdir -p logs
```

5. **Iniciar MongoDB**

```bash
# En sistemas Unix/Mac
mongod

# O usando Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

6. **Iniciar el servidor**

```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start
```

## ⚙️ Configuración

### 1. Configurar Twilio WhatsApp

1. Crear cuenta en [Twilio](https://www.twilio.com)
2. Habilitar WhatsApp Business API
3. Configurar webhook URL: `https://tu-dominio.com/webhook/whatsapp`
4. Método: `POST`
5. Token de verificación: El definido en `WEBHOOK_VERIFY_TOKEN`

### 2. Configurar OpenAI

1. Obtener API Key en [OpenAI Platform](https://platform.openai.com)
2. Configurar en `.env`: `OPENAI_API_KEY`
3. Modelo recomendado: `gpt-4-turbo-preview`

### 3. Configurar Google Maps API

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com)
2. Habilitar APIs:
   - Distance Matrix API
   - Geocoding API
   - Places API
3. Crear API Key y configurar en `.env`

### 4. Configurar Stripe

1. Crear cuenta en [Stripe](https://stripe.com)
2. Obtener claves en Dashboard → API Keys
3. Configurar webhook para eventos:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. URL del webhook: `https://tu-dominio.com/webhook/stripe`

### 5. Exponer servidor local (Desarrollo)

Para desarrollo local, usa ngrok:

```bash
ngrok http 3000
```

Copia la URL generada y configúrala en Twilio y Stripe webhooks.

## 🚀 Uso

### Flujo del Cliente

1. **Inicio de conversación**
   - Cliente envía mensaje a número de WhatsApp
   - Bot solicita registro (nombre)

2. **Solicitar servicio**
   ```
   Cliente: "Necesito un plomero"
   ```

3. **Confirmar categoría**
   ```
   Bot: "Entiendo que necesitas un plomero. ¿Es correcto?"
   Cliente: "Sí"
   ```

4. **Compartir ubicación**
   ```
   Bot: "Por favor comparte tu ubicación"
   Cliente: [Comparte ubicación GPS]
   ```

5. **Seleccionar prestador**
   ```
   Bot: "Encontré 3 prestadores cerca de ti:"
   1. Juan Pérez - ⭐ 4.8 - $50/hora - 2.3 km
   2. María González - ⭐ 4.9 - $45/hora - 3.1 km

   Cliente: "1"
   ```

6. **Describir problema**
   ```
   Bot: "Describe el problema"
   Cliente: "Se rompió una tubería en la cocina"
   ```

7. **Realizar pago**
   ```
   Bot: "Para confirmar, realiza un depósito de $20"
   [Link de pago]
   ```

8. **Confirmación**
   ```
   Bot: "Pago confirmado. Juan Pérez ha sido notificado"
   ```

### Flujo del Prestador

1. **Recibir notificación**
   ```
   Bot: "🔔 Nueva solicitud de trabajo

   👤 Cliente: Ana López
   🔧 Servicio: Plomería
   📍 Ubicación: Calle 123
   💰 Pago: $50/hora

   ¿Aceptas este trabajo?
   1. Aceptar
   2. Rechazar"
   ```

2. **Aceptar trabajo**
   ```
   Prestador: "1"

   Bot: "Perfecto. Datos del cliente:
   Nombre: Ana López
   Teléfono: +52 555 123 4567
   [Link de Google Maps]"
   ```

3. **Completar trabajo**
   ```
   Prestador: "He terminado el trabajo"

   Bot (al cliente): "El prestador indica que terminó.
   ¿Confirmas que todo está bien?"
   ```

## 📊 Modelos de Datos

### User Schema

```javascript
{
  phoneNumber: String,
  name: String,
  role: 'client' | 'provider',
  status: 'active' | 'inactive' | 'suspended',
  location: {
    type: 'Point',
    coordinates: [longitude, latitude]
  },
  providerInfo: {
    categories: [String],
    hourlyRate: Number,
    rating: Number,
    reviewsCount: Number,
    availability: 'available' | 'busy' | 'offline'
  }
}
```

### Ticket Schema

```javascript
{
  client: ObjectId,
  provider: ObjectId,
  category: String,
  description: String,
  status: 'pending' | 'accepted' | 'in_progress' | 'completed',
  location: {
    type: 'Point',
    coordinates: [longitude, latitude]
  },
  pricing: {
    hourlyRate: Number,
    depositAmount: Number,
    actualHours: Number,
    totalAmount: Number
  },
  payment: {
    depositPaymentIntentId: String,
    depositStatus: 'pending' | 'completed' | 'failed'
  }
}
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo con auto-reload
npm run dev

# Producción
npm start

# Tests (pendiente implementar)
npm test
```

## 🌐 Deployment

### Deployment en Heroku

```bash
# Instalar Heroku CLI
npm install -g heroku

# Login
heroku login

# Crear app
heroku create tu-app-name

# Configurar variables de entorno
heroku config:set TWILIO_ACCOUNT_SID=ACxxxxxx
heroku config:set TWILIO_AUTH_TOKEN=xxxxxx
# ... todas las demás variables

# Agregar MongoDB Atlas
heroku addons:create mongolab:sandbox

# Deploy
git push heroku main

# Ver logs
heroku logs --tail
```

### Deployment en Railway

1. Conectar repositorio de GitHub
2. Configurar variables de entorno en Dashboard
3. Deploy automático en cada push

### Deployment en VPS (Digital Ocean, AWS, etc.)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar aplicación
pm2 start src/server.js --name taskrabbit-whatsapp

# Ver logs
pm2 logs

# Configurar auto-start
pm2 startup
pm2 save
```

## 📱 Testing

### Test Manual con Postman

```bash
# Test de webhook de WhatsApp
POST http://localhost:3000/webhook/whatsapp
Content-Type: application/x-www-form-urlencoded

From=whatsapp:+5215551234567&
Body=Necesito un plomero&
MessageSid=SMxxxxxx
```

### Test con cURL

```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -d "From=whatsapp:+5215551234567" \
  -d "Body=Necesito un plomero" \
  -d "MessageSid=SM123456"
```

## 🐛 Troubleshooting

### Error: "MongoDB connection failed"
- Verificar que MongoDB esté corriendo
- Verificar `MONGODB_URI` en `.env`

### Error: "Twilio authentication failed"
- Verificar `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN`
- Verificar que el webhook esté configurado correctamente

### No se reciben mensajes
- Verificar que ngrok esté corriendo (desarrollo)
- Verificar URL del webhook en Twilio
- Revisar logs: `tail -f logs/combined.log`

## 🔒 Seguridad

- ✅ Validación de firma de Twilio en webhooks
- ✅ Variables de entorno para credenciales
- ✅ Rate limiting en endpoints
- ✅ Helmet.js para headers de seguridad
- ✅ Encriptación de datos sensibles

## 📄 Licencia

MIT License - Ver archivo [LICENSE](LICENSE)

## 👥 Contribución

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Para soporte y preguntas:
- Email: soporte@tudominio.com
- GitHub Issues: [Crear Issue](https://github.com/tu-usuario/taskrabbit-whatsapp/issues)

## 🙏 Agradecimientos

- [Twilio](https://www.twilio.com) - WhatsApp Business API
- [OpenAI](https://openai.com) - GPT-4
- [Stripe](https://stripe.com) - Procesamiento de pagos
- [Google Maps](https://developers.google.com/maps) - Geolocalización

---

**Desarrollado con ❤️ para facilitar la conexión entre clientes y prestadores de servicios**
