# Diagrama de Flujo Conversacional - TaskRabbit WhatsApp

## 1. Flujo del Cliente

```
┌─────────────────────────────────────────────────────────────┐
│                    INICIO - Cliente                          │
│          Usuario envía mensaje a WhatsApp                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Identificar Tipo de Usuario                     │
│         ¿Usuario existe en la base de datos?                 │
└──────────┬─────────────────────────────┬────────────────────┘
           │                             │
      NO   │                             │  SÍ
           ▼                             ▼
┌──────────────────────┐    ┌────────────────────────────────┐
│  Registro de Cliente │    │   Bienvenida Personalizada     │
│                      │    │ "Hola [Nombre], ¿en qué puedo │
│ Bot: "Hola, soy tu  │    │     ayudarte hoy?"            │
│ asistente. ¿Cuál es │    └────────────┬───────────────────┘
│ tu nombre?"          │                 │
│                      │                 │
│ Guardar: nombre,     │                 │
│ teléfono             │                 │
└──────────┬───────────┘                 │
           │                             │
           └──────────────┬──────────────┘
                          │
                          ▼
           ┌──────────────────────────────────────────┐
           │    Procesamiento NLP con OpenAI          │
           │                                          │
           │ Analizar mensaje para extraer:          │
           │ - Categoría de servicio                 │
           │ - Urgencia                              │
           │ - Detalles adicionales                  │
           └──────────────┬───────────────────────────┘
                          │
                          ▼
           ┌──────────────────────────────────────────┐
           │       Confirmación de Categoría          │
           │                                          │
           │ Bot: "Entiendo que necesitas un         │
           │ [PLOMERO]. ¿Es correcto?"                │
           │                                          │
           │ [✓ Sí, correcto] [✗ No, otra cosa]      │
           └──────────┬──────────────┬────────────────┘
                      │              │
                  SÍ  │              │ NO
                      │              └──────────┐
                      ▼                         │
           ┌──────────────────────────┐         │
           │   Solicitar Ubicación    │         │
           │                          │         │
           │ Bot: "Por favor comparte │         │
           │ tu ubicación"            │         │
           │                          │         │
           │ [Botón: 📍 Compartir     │         │
           │        Ubicación]        │         │
           └──────────┬───────────────┘         │
                      │                         │
                      ▼                         │
           ┌──────────────────────────┐         │
           │  Recibir Ubicación GPS   │         │
           │ (lat, lng)               │         │
           └──────────┬───────────────┘         │
                      │                         │
                      ▼                         │
           ┌──────────────────────────────────┐ │
           │  Consultar Base de Datos         │ │
           │                                  │ │
           │ SELECT prestadores WHERE:        │ │
           │ - categoria = [categoria]        │ │
           │ - estado = 'disponible'          │ │
           │ - distancia < 10km               │ │
           │                                  │ │
           │ Calcular distancia con           │ │
           │ Google Maps Distance Matrix API  │ │
           └──────────┬───────────────────────┘ │
                      │                         │
                      ▼                         │
           ┌──────────────────────────────────┐ │
           │  ¿Hay prestadores disponibles?   │ │
           └───┬──────────────────┬───────────┘ │
               │                  │             │
           NO  │                  │  SÍ         │
               │                  │             │
               ▼                  ▼             │
    ┌──────────────────┐  ┌─────────────────────────────────┐
    │  Sin Prestadores │  │  Enviar Lista de Prestadores    │
    │                  │  │                                 │
    │ Bot: "Lo siento, │  │ Bot: "Encontré [N] prestadores │
    │ no hay           │  │ cerca de ti:"                   │
    │ prestadores      │  │                                 │
    │ disponibles en   │  │ [Lista Interactiva WhatsApp]    │
    │ tu zona. ¿Deseas │  │                                 │
    │ ampliar el       │  │ 1. Juan Pérez                   │
    │ radio de         │  │    ⭐ 4.8/5.0 (127 reseñas)     │
    │ búsqueda?"       │  │    💰 $50/hora                   │
    │                  │  │    📍 2.3 km de distancia        │
    │ [Sí] [No]        │  │                                 │
    └──────────────────┘  │ 2. María González               │
                          │    ⭐ 4.9/5.0 (84 reseñas)      │
                          │    💰 $45/hora                   │
                          │    📍 3.1 km de distancia        │
                          │                                 │
                          │ "Selecciona un prestador"       │
                          └─────────────┬───────────────────┘
                                        │
                                        ▼
                          ┌─────────────────────────────────┐
                          │  Cliente Selecciona Prestador   │
                          └─────────────┬───────────────────┘
                                        │
                                        ▼
                          ┌─────────────────────────────────┐
                          │   Confirmar Detalles del        │
                          │        Servicio                 │
                          │                                 │
                          │ Bot: "Resumen de tu solicitud:  │
                          │                                 │
                          │ 👨‍🔧 Prestador: Juan Pérez        │
                          │ 🔧 Servicio: Plomería            │
                          │ 📍 Ubicación: [dirección]        │
                          │ 💰 Tarifa: $50/hora              │
                          │                                 │
                          │ Por favor describe el problema: │
                          └─────────────┬───────────────────┘
                                        │
                                        ▼
                          ┌─────────────────────────────────┐
                          │  Cliente Describe el Problema   │
                          │  (Mensaje de texto)             │
                          └─────────────┬───────────────────┘
                                        │
                                        ▼
                          ┌─────────────────────────────────┐
                          │  Generar Link de Pago           │
                          │                                 │
                          │ Bot: "Para confirmar tu         │
                          │ solicitud, realiza un depósito  │
                          │ de garantía de $20"             │
                          │                                 │
                          │ 💳 [Link de Stripe/MercadoPago] │
                          │                                 │
                          │ "Una vez confirmado el pago,    │
                          │ notificaremos al prestador"     │
                          └─────────────┬───────────────────┘
                                        │
                                        ▼
                          ┌─────────────────────────────────┐
                          │   Webhook de Confirmación       │
                          │        de Pago                  │
                          └───┬─────────────────┬───────────┘
                              │                 │
                         ÉXITO│                 │FALLO
                              │                 │
                              ▼                 ▼
                ┌──────────────────────┐  ┌────────────────┐
                │  Notificar Cliente   │  │ Bot: "El pago  │
                │                      │  │ no se completó.│
                │ Bot: "✅ Pago        │  │ Intenta de     │
                │ confirmado. Hemos    │  │ nuevo"         │
                │ notificado a Juan.   │  └────────────────┘
                │ Te contactará        │
                │ pronto."             │
                │                      │
                │ [Crear ticket en DB] │
                └──────────┬───────────┘
                           │
                           ▼
                ┌─────────────────────────────────┐
                │  NOTIFICAR AL PRESTADOR         │
                │  (Ver Flujo del Prestador)      │
                └─────────────────────────────────┘
```

## 2. Flujo del Prestador

```
┌─────────────────────────────────────────────────────────────┐
│                 INICIO - Prestador                           │
│        Recibe notificación de nuevo trabajo                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Notificación de Trabajo                          │
│                                                             │
│ Bot: "🔔 Nueva solicitud de trabajo                        │
│                                                             │
│ 👤 Cliente: Ana López                                       │
│ 🔧 Servicio: Plomería                                       │
│ 📍 Ubicación: Calle 123, Colonia Centro                     │
│ 📏 Distancia: 2.3 km de tu ubicación                        │
│ 💰 Pago: $50/hora                                           │
│ 📝 Descripción: 'Se rompió una tubería en la cocina'       │
│                                                             │
│ ¿Aceptas este trabajo?"                                    │
│                                                             │
│ [✅ Aceptar] [❌ Rechazar]                                  │
└───────────┬────────────────────────┬────────────────────────┘
            │                        │
       ACEPTAR                   RECHAZAR
            │                        │
            ▼                        ▼
┌───────────────────────┐  ┌─────────────────────────────────┐
│  Actualizar Estado    │  │  Bot: "Entendido. Hemos         │
│  en Base de Datos     │  │  rechazado el trabajo."         │
│                       │  │                                 │
│ ticket.estado =       │  │  [Buscar siguiente prestador    │
│  'aceptado'           │  │   en la lista]                  │
│ ticket.prestador_id = │  │                                 │
│  [prestador_id]       │  │  [Notificar al cliente que el   │
│                       │  │   prestador no está disponible] │
└───────────┬───────────┘  └─────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│         Confirmación y Datos de Contacto                    │
│                                                             │
│ Bot: "✅ Perfecto. El cliente ha sido notificado.          │
│                                                             │
│ 📞 Contacto del cliente:                                    │
│ Nombre: Ana López                                           │
│ Teléfono: +52 555 123 4567                                  │
│ Ubicación: [Link de Google Maps]                           │
│                                                             │
│ Puedes contactar directamente al cliente o continuar       │
│ la conversación aquí."                                     │
│                                                             │
│ [💬 Abrir chat con cliente]                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Notificar al Cliente                           │
│                                                             │
│ Bot (al cliente): "✅ Buenas noticias!                     │
│                                                             │
│ Juan Pérez ha aceptado tu solicitud.                       │
│                                                             │
│ 📞 Teléfono: +52 555 987 6543                               │
│ ⏱️  Llegará aproximadamente en: 30 minutos                  │
│                                                             │
│ Puedes contactarlo directamente o continuar aquí."         │
│                                                             │
│ [💬 Abrir chat con prestador]                              │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 Chat Tripartito (Opcional)                  │
│                                                             │
│ Sistema de mensajería que permite:                         │
│ - Cliente ↔ Prestador comunicación directa                 │
│ - Bot como moderador/facilitador                           │
│ - Actualización de estado del servicio                     │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Actualización de Estado                        │
│                                                             │
│ Prestador puede actualizar:                                │
│ "En camino" → "Llegué" → "Trabajando" → "Completado"       │
│                                                             │
│ Bot notifica al cliente cada cambio de estado              │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                Finalización del Servicio                    │
│                                                             │
│ Prestador: "He terminado el trabajo"                       │
│                                                             │
│ Bot (al cliente): "El prestador indica que el trabajo      │
│ está completo. ¿Confirmas que todo está bien?"             │
│                                                             │
│ [✅ Sí, todo bien] [⚠️ Hay un problema]                    │
└───────────┬──────────────────────┬─────────────────────────┘
            │                      │
       CONFIRMA               HAY PROBLEMA
            │                      │
            ▼                      ▼
┌───────────────────────┐  ┌──────────────────────────────┐
│  Solicitar Calificación│  │  Abrir proceso de resolución│
│                       │  │  de disputas                │
│ Bot: "Por favor      │  │                              │
│ califica el servicio:│  │  [Escalar a soporte humano] │
│                      │  └──────────────────────────────┘
│ ⭐⭐⭐⭐⭐           │
│                      │
│ Comentarios:         │
│ [Campo de texto]     │
│                      │
│ ¿Darías propina?"    │
│ [Sí] [No]            │
└───────────┬──────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Procesar Pago Final                            │
│                                                             │
│ - Cobrar tarifa por horas trabajadas                       │
│ - Procesar propina (si aplica)                             │
│ - Transferir fondos al prestador                           │
│ - Guardar calificación                                     │
│                                                             │
│ Bot: "✅ Pago procesado exitosamente.                      │
│ Gracias por usar nuestro servicio!"                        │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
              [FIN DEL FLUJO]
```

## 3. Registro de Prestador

```
┌─────────────────────────────────────────────────────────────┐
│           REGISTRO DE NUEVO PRESTADOR                       │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "Bienvenido al proceso de registro como prestador.    │
│                                                             │
│ 1️⃣  Nombre completo:"                                      │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ "2️⃣  ¿Qué servicio ofreces?"                               │
│                                                             │
│ [Lista de categorías]                                      │
│ - Plomería                                                 │
│ - Electricidad                                             │
│ - Limpieza                                                 │
│ - Carpintería                                              │
│ - Etc.                                                     │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ "3️⃣  Comparte tu ubicación base de operación"              │
│                                                             │
│ [📍 Compartir Ubicación]                                    │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ "4️⃣  Tarifa por hora (en tu moneda local):"                │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ "5️⃣  Documentos de verificación:                            │
│                                                             │
│ - Foto de identificación                                   │
│ - Foto de certificación (si aplica)                        │
│ - Referencias                                              │
│                                                             │
│ [Enviar fotos]"                                            │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ "6️⃣  Configuración de cuenta bancaria para pagos           │
│                                                             │
│ [Link a formulario seguro]"                                │
└────────────────────┬───────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Bot: "✅ Registro completado.                              │
│                                                             │
│ Tu perfil está en revisión. Te notificaremos en 24-48      │
│ horas una vez aprobado.                                    │
│                                                             │
│ Mientras tanto, completa tu perfil con fotos de trabajos   │
│ anteriores para mejorar tus oportunidades."                │
└─────────────────────────────────────────────────────────────┘
```

## 4. Estados del Sistema

### Estados del Ticket
- `pendiente`: Solicitud creada, esperando aceptación
- `aceptado`: Prestador aceptó el trabajo
- `en_camino`: Prestador se dirige al lugar
- `en_progreso`: Prestador está trabajando
- `completado`: Trabajo finalizado
- `cancelado`: Cancelado por cliente o prestador
- `disputado`: Hay un problema que requiere resolución

### Estados del Prestador
- `disponible`: Puede recibir nuevas solicitudes
- `ocupado`: Tiene un trabajo activo
- `offline`: No está disponible temporalmente
- `en_revision`: Perfil en proceso de verificación
- `suspendido`: Cuenta suspendida

### Estados del Cliente
- `activo`: Puede hacer solicitudes
- `con_servicio_activo`: Tiene un servicio en curso
- `bloqueado`: No puede usar el servicio

## 5. Manejo de Casos Especiales

### 5.1 Cancelación por Cliente
```
Cliente: "Quiero cancelar"
  │
  ▼
Bot: "¿Estás seguro que deseas cancelar?"
[Sí] [No]
  │
  ▼ (Sí)
Verificar estado del servicio:
  │
  ├─ Si no ha sido aceptado → Reembolso 100%
  ├─ Si fue aceptado pero no iniciado → Reembolso 50%
  └─ Si ya inició → Sin reembolso, cargo completo
```

### 5.2 Prestador No Responde
```
Notificación enviada
  │
  ├─ Esperar 5 minutos
  │
  ├─ Sin respuesta → Notificar siguiente prestador
  │
  └─ Después de 3 prestadores sin respuesta:
      → Ampliar radio de búsqueda
      → Notificar al cliente del retraso
```

### 5.3 Emergencias
```
Cliente: "Es una emergencia"
  │
  ▼
Bot detecta palabra clave "emergencia"
  │
  ▼
Bot: "Entiendo que es urgente. Priorizando tu solicitud..."
  │
  ▼
Filtrar solo prestadores con flag "acepta_emergencias"
Aumentar tarifa automáticamente (+50%)
Notificar simultáneamente a top 3 prestadores
```
