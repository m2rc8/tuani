# 🚀 Guía de Inicio Rápido

Esta guía te llevará de 0 a tener el sistema funcionando en **menos de 30 minutos**.

## ⚡ Instalación Rápida

### 1. Clonar e Instalar (5 minutos)

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/taskrabbit-whatsapp.git
cd taskrabbit-whatsapp

# Instalar dependencias
npm install

# Crear estructura de carpetas
mkdir logs
```

### 2. Configurar Variables de Entorno (10 minutos)

```bash
# Copiar archivo de ejemplo
cp .env.example .env
```

Edita `.env` con tus credenciales mínimas:

```env
# Obligatorias para funcionar
PORT=3000
MONGODB_URI=mongodb://localhost:27017/taskrabbit-whatsapp
TWILIO_ACCOUNT_SID=tu_account_sid_aqui
TWILIO_AUTH_TOKEN=tu_auth_token_aqui
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
OPENAI_API_KEY=sk-tu_key_aqui

# Opcionales (puedes dejarlas vacías para empezar)
GOOGLE_MAPS_API_KEY=
STRIPE_SECRET_KEY=
```

### 3. Iniciar MongoDB (2 minutos)

**Opción A: Docker (Recomendado)**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Opción B: Local**
```bash
mongod
```

### 4. Exponer Servidor Local (3 minutos)

Necesitas exponer tu servidor local para que Twilio pueda enviar webhooks:

```bash
# Instalar ngrok
npm install -g ngrok

# Exponer puerto 3000
ngrok http 3000
```

Copia la URL que ngrok te da (ejemplo: `https://abc123.ngrok.io`)

### 5. Configurar Webhook de Twilio (5 minutos)

1. Ve a [Twilio Console](https://console.twilio.com)
2. WhatsApp → Sandbox Settings
3. En "WHEN A MESSAGE COMES IN":
   - URL: `https://abc123.ngrok.io/webhook/whatsapp`
   - Método: `POST`
4. Guardar

### 6. Iniciar Aplicación (1 minuto)

```bash
npm run dev
```

Deberías ver:
```
🚀 Servidor corriendo en puerto 3000
📱 Webhook WhatsApp: http://localhost:3000/webhook/whatsapp
✅ MongoDB conectado exitosamente
```

## 🧪 Probar el Sistema

### Test 1: Mensaje Básico

1. Abre WhatsApp en tu teléfono
2. Envía mensaje al número sandbox de Twilio
3. Primero, envía el código de activación (lo encuentras en Twilio Console)
4. Luego envía: `Hola`

**Respuesta esperada:**
```
👋 ¡Hola! Bienvenido a nuestro servicio de asistencia.

¿Cómo te gustaría usar nuestra plataforma?

1️⃣ Soy Cliente - Necesito contratar un servicio
2️⃣ Soy Prestador - Quiero ofrecer mis servicios

Por favor escribe 1 o 2.
```

### Test 2: Flujo Completo de Cliente

1. Responde: `1`
2. Cuando te pida nombre: `Juan Pérez`
3. Cuando pregunte qué necesitas: `Necesito un plomero`
4. Confirma categoría: `Sí`
5. Comparte tu ubicación (botón de adjuntar → ubicación)

**Lo que debería pasar:**
- Bot identifica la categoría "Plomería"
- Busca prestadores cercanos en la base de datos
- Si hay prestadores: muestra lista
- Si no hay: te informa que no hay disponibles

## 🔧 Solución de Problemas Comunes

### Error: "MongoDB connection failed"

```bash
# Verifica que MongoDB esté corriendo
# En otra terminal:
mongo
# Si no funciona, inicia MongoDB
```

### Error: "Twilio authentication failed"

- Verifica `TWILIO_ACCOUNT_SID` y `TWILIO_AUTH_TOKEN` en `.env`
- Asegúrate de no tener espacios extra

### No recibo mensajes del bot

1. Verifica que ngrok esté corriendo
2. Verifica la URL del webhook en Twilio
3. Revisa los logs:
   ```bash
   tail -f logs/combined.log
   ```

### OpenAI responde lento

- Normal en la primera llamada (inicializa modelo)
- Considera usar `gpt-3.5-turbo` en lugar de `gpt-4` para pruebas

## 📊 Crear Datos de Prueba

Para probar el sistema completo, necesitas crear prestadores de prueba:

### Script de Seed (Crear en `/scripts/seed.js`)

```javascript
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/taskrabbit-whatsapp');

  // Crear prestador de ejemplo
  await User.create({
    phoneNumber: '+5215551234567',
    name: 'Juan Pérez',
    role: 'provider',
    status: 'active',
    location: {
      type: 'Point',
      coordinates: [-99.1332, 19.4326] // CDMX
    },
    providerInfo: {
      categories: ['Plomería'],
      hourlyRate: 50,
      availability: 'available',
      rating: 4.8,
      reviewsCount: 127,
      acceptsEmergencies: true,
      serviceRadius: 10,
      verification: {
        backgroundCheck: {
          status: 'approved'
        }
      }
    }
  });

  console.log('✅ Prestador de prueba creado');
  process.exit(0);
}

seed();
```

Ejecutar:
```bash
node scripts/seed.js
```

## 🎯 Próximos Pasos

Ahora que tienes el sistema funcionando:

1. **Lee la documentación completa**: [README.md](README.md)
2. **Revisa los flujos**: [DIAGRAMA_FLUJO.md](DIAGRAMA_FLUJO.md)
3. **Entiende el prompt de IA**: [PROMPT_SISTEMA_IA.md](PROMPT_SISTEMA_IA.md)
4. **Configura pagos**: Agrega Stripe/MercadoPago
5. **Configura Google Maps**: Para búsqueda geolocalizada real

## 🆘 ¿Necesitas Ayuda?

- **Documentación completa**: Ver [README.md](README.md)
- **Issues**: [GitHub Issues](https://github.com/tu-usuario/taskrabbit-whatsapp/issues)
- **Logs detallados**:
  ```bash
  # Ver todos los logs
  tail -f logs/combined.log

  # Ver solo errores
  tail -f logs/error.log
  ```

## ✅ Checklist de Configuración

- [ ] Node.js instalado (v16+)
- [ ] MongoDB corriendo
- [ ] Variables de entorno configuradas
- [ ] ngrok exponiendo puerto 3000
- [ ] Webhook configurado en Twilio
- [ ] Servidor iniciado (`npm run dev`)
- [ ] Mensaje de prueba enviado y respondido
- [ ] Prestador de prueba creado

**¡Felicidades! Si completaste todos los pasos, tienes el sistema funcionando.** 🎉
