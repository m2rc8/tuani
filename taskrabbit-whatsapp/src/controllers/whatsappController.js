const twilioService = require('../services/twilioService');
const openaiService = require('../services/openaiService');
const conversationManager = require('../services/conversationManager');
const logger = require('../utils/logger');
const User = require('../models/User');
const Ticket = require('../models/Ticket');

/**
 * Controlador principal para manejar mensajes entrantes de WhatsApp
 */
exports.handleIncomingMessage = async (req, res) => {
  try {
    // Responder inmediatamente a Twilio (200 OK)
    res.status(200).send('OK');

    const {
      From: phoneNumber,
      Body: messageBody,
      MessageSid: messageSid,
      Latitude: latitude,
      Longitude: longitude,
      MediaUrl0: mediaUrl,
      MediaContentType0: mediaType,
      ButtonPayload: buttonPayload,
      ListReply: listReply
    } = req.body;

    logger.info(`📨 Mensaje recibido de ${phoneNumber}: ${messageBody}`);

    // Procesar el mensaje de forma asíncrona
    await processMessage({
      phoneNumber,
      messageBody,
      messageSid,
      latitude,
      longitude,
      mediaUrl,
      mediaType,
      buttonPayload,
      listReply
    });

  } catch (error) {
    logger.error('Error al procesar mensaje:', error);
    // No enviamos error al cliente, ya respondimos 200 OK
  }
};

/**
 * Procesa el mensaje de forma asíncrona
 */
async function processMessage(data) {
  const {
    phoneNumber,
    messageBody,
    latitude,
    longitude,
    buttonPayload,
    listReply
  } = data;

  try {
    // 1. Buscar o crear usuario
    let user = await User.findOne({ phoneNumber });

    if (!user) {
      user = await handleNewUser(phoneNumber);
      return;
    }

    // 2. Obtener o crear contexto de conversación
    const conversation = await conversationManager.getConversation(phoneNumber);

    // 3. Determinar el tipo de mensaje
    let userInput;
    let inputType;

    if (buttonPayload) {
      // Usuario presionó un botón
      inputType = 'button';
      userInput = buttonPayload;
    } else if (listReply) {
      // Usuario seleccionó de una lista
      inputType = 'list';
      userInput = JSON.parse(listReply).id;
    } else if (latitude && longitude) {
      // Usuario compartió ubicación
      inputType = 'location';
      userInput = { latitude, longitude };
    } else {
      // Mensaje de texto normal
      inputType = 'text';
      userInput = messageBody;
    }

    // 4. Agregar mensaje a la conversación
    conversation.addMessage('user', userInput, inputType);

    // 5. Determinar el estado actual del usuario
    const currentState = conversation.state || 'idle';

    logger.info(`📊 Estado actual de ${phoneNumber}: ${currentState}`);

    // 6. Ejecutar la lógica del estado correspondiente
    await handleUserState(user, conversation, currentState, userInput, inputType);

  } catch (error) {
    logger.error('Error en processMessage:', error);
    await twilioService.sendMessage(
      phoneNumber,
      '❌ Ocurrió un error al procesar tu mensaje. Por favor intenta nuevamente.'
    );
  }
}

/**
 * Maneja nuevos usuarios
 */
async function handleNewUser(phoneNumber) {
  const user = await User.create({
    phoneNumber,
    role: 'pending', // No sabemos si es cliente o prestador aún
    status: 'active'
  });

  await twilioService.sendMessage(
    phoneNumber,
    '👋 ¡Hola! Bienvenido a nuestro servicio de asistencia.\n\n' +
    '¿Cómo te gustaría usar nuestra plataforma?\n\n' +
    '1️⃣ Soy *Cliente* - Necesito contratar un servicio\n' +
    '2️⃣ Soy *Prestador* - Quiero ofrecer mis servicios\n\n' +
    'Por favor escribe 1 o 2.'
  );

  const conversation = await conversationManager.createConversation(phoneNumber);
  conversation.setState('awaiting_role_selection');

  return user;
}

/**
 * Maneja la lógica según el estado del usuario
 */
async function handleUserState(user, conversation, state, input, inputType) {
  const phoneNumber = user.phoneNumber;

  switch (state) {
    case 'awaiting_role_selection':
      await handleRoleSelection(user, conversation, input);
      break;

    case 'awaiting_name':
      await handleNameInput(user, conversation, input);
      break;

    case 'idle':
      await handleIdleState(user, conversation, input, inputType);
      break;

    case 'awaiting_category_confirmation':
      await handleCategoryConfirmation(user, conversation, input);
      break;

    case 'awaiting_location':
      await handleLocationInput(user, conversation, input, inputType);
      break;

    case 'awaiting_provider_selection':
      await handleProviderSelection(user, conversation, input, inputType);
      break;

    case 'awaiting_problem_description':
      await handleProblemDescription(user, conversation, input);
      break;

    case 'awaiting_provider_response':
      // El prestador está siendo notificado, esperando respuesta
      await twilioService.sendMessage(
        phoneNumber,
        '⏳ Hemos notificado a los prestadores. Te avisaremos cuando uno acepte tu solicitud.'
      );
      break;

    case 'service_in_progress':
      await handleServiceInProgress(user, conversation, input);
      break;

    case 'awaiting_rating':
      await handleRating(user, conversation, input, inputType);
      break;

    // Estados del prestador
    case 'provider_awaiting_job_response':
      await handleProviderJobResponse(user, conversation, input, inputType);
      break;

    default:
      logger.warn(`Estado desconocido: ${state}`);
      await handleIdleState(user, conversation, input, inputType);
  }
}

/**
 * Maneja la selección de rol (Cliente vs Prestador)
 */
async function handleRoleSelection(user, conversation, input) {
  const choice = input.trim();

  if (choice === '1' || choice.toLowerCase().includes('cliente')) {
    user.role = 'client';
    await user.save();

    await twilioService.sendMessage(
      user.phoneNumber,
      '✅ Perfecto, te has registrado como *Cliente*.\n\n' +
      'Para comenzar, ¿cuál es tu nombre?'
    );

    conversation.setState('awaiting_name');
    conversation.data.registrationType = 'client';

  } else if (choice === '2' || choice.toLowerCase().includes('prestador')) {
    user.role = 'provider';
    await user.save();

    await twilioService.sendMessage(
      user.phoneNumber,
      '✅ Perfecto, te has registrado como *Prestador de Servicios*.\n\n' +
      'Para comenzar tu registro, ¿cuál es tu nombre completo?'
    );

    conversation.setState('awaiting_name');
    conversation.data.registrationType = 'provider';

  } else {
    await twilioService.sendMessage(
      user.phoneNumber,
      '❌ Por favor escribe *1* para Cliente o *2* para Prestador.'
    );
  }
}

/**
 * Maneja la entrada del nombre
 */
async function handleNameInput(user, conversation, input) {
  user.name = input.trim();
  await user.save();

  if (conversation.data.registrationType === 'client') {
    await twilioService.sendMessage(
      user.phoneNumber,
      `✅ Gracias ${user.name}!\n\n` +
      'Tu registro está completo. Ahora puedes solicitar servicios.\n\n' +
      '¿En qué puedo ayudarte hoy?'
    );
    conversation.setState('idle');

  } else if (conversation.data.registrationType === 'provider') {
    // Iniciar proceso de registro de prestador (más complejo)
    await require('../services/providerRegistration').startRegistration(user, conversation);
  }
}

/**
 * Estado idle: Usuario puede hacer una nueva solicitud
 */
async function handleIdleState(user, conversation, input, inputType) {
  if (user.role === 'client') {
    await handleClientRequest(user, conversation, input);
  } else if (user.role === 'provider') {
    await handleProviderIdleMessage(user, conversation, input);
  }
}

/**
 * Maneja solicitud de servicio del cliente
 */
async function handleClientRequest(user, conversation, input) {
  // Usar OpenAI para analizar la solicitud
  const analysis = await openaiService.analyzeServiceRequest(input);

  logger.info('Análisis de OpenAI:', analysis);

  if (analysis.category) {
    // Se detectó una categoría
    conversation.data.detectedCategory = analysis.category;
    conversation.data.urgency = analysis.urgency || 'normal';
    conversation.data.details = analysis.details || '';

    await twilioService.sendMessageWithButtons(
      user.phoneNumber,
      `Entiendo que necesitas un servicio de *${analysis.category}*.\n\n` +
      `${analysis.details ? 'Detalles: ' + analysis.details + '\n\n' : ''}` +
      '¿Es correcto?',
      [
        { id: 'confirm_category_yes', title: '✅ Sí, correcto' },
        { id: 'confirm_category_no', title: '❌ No, otra cosa' }
      ]
    );

    conversation.setState('awaiting_category_confirmation');

  } else {
    // No se pudo detectar la categoría
    await twilioService.sendMessage(
      user.phoneNumber,
      '🤔 No estoy seguro de entender qué servicio necesitas.\n\n' +
      'Por favor escribe el tipo de servicio que buscas, por ejemplo:\n' +
      '• Plomero\n' +
      '• Electricista\n' +
      '• Servicio de limpieza\n' +
      '• Carpintero\n' +
      '• Etc.'
    );
  }
}

/**
 * Confirmación de categoría detectada
 */
async function handleCategoryConfirmation(user, conversation, input) {
  if (input === 'confirm_category_yes' || input.toLowerCase().includes('sí')) {
    // Categoría confirmada, solicitar ubicación
    await twilioService.sendLocationRequest(
      user.phoneNumber,
      '📍 Perfecto. Para encontrar prestadores cerca de ti, por favor comparte tu ubicación.\n\n' +
      'Presiona el botón de adjuntar 📎 y selecciona "Ubicación".'
    );

    conversation.setState('awaiting_location');

  } else {
    // Categoría incorrecta, pedir nuevamente
    await twilioService.sendMessage(
      user.phoneNumber,
      '¿Qué tipo de servicio necesitas?\n\n' +
      'Por favor descríbelo con tus propias palabras.'
    );

    conversation.setState('idle');
  }
}

/**
 * Maneja la entrada de ubicación
 */
async function handleLocationInput(user, conversation, input, inputType) {
  if (inputType === 'location') {
    const { latitude, longitude } = input;

    conversation.data.clientLocation = {
      latitude,
      longitude,
      timestamp: new Date()
    };

    await twilioService.sendMessage(
      user.phoneNumber,
      '✅ Ubicación recibida. Buscando prestadores disponibles cerca de ti...'
    );

    // Buscar prestadores disponibles
    const providersService = require('../services/providersService');
    const providers = await providersService.findNearbyProviders({
      category: conversation.data.detectedCategory,
      latitude,
      longitude,
      radius: process.env.DEFAULT_SEARCH_RADIUS_KM || 10
    });

    if (providers.length === 0) {
      await twilioService.sendMessageWithButtons(
        user.phoneNumber,
        '😔 Lo siento, no encontré prestadores disponibles en tu zona.\n\n' +
        '¿Deseas ampliar el radio de búsqueda?',
        [
          { id: 'expand_search_yes', title: '✅ Sí, ampliar' },
          { id: 'expand_search_no', title: '❌ No, cancelar' }
        ]
      );
      return;
    }

    // Enviar lista de prestadores
    const providersList = providers.map((provider, index) => ({
      id: `provider_${provider._id}`,
      title: provider.name,
      description: `⭐ ${provider.rating}/5.0 (${provider.reviewsCount} reseñas)\n💰 $${provider.hourlyRate}/hora\n📍 ${provider.distance.toFixed(1)} km`
    }));

    await twilioService.sendList(
      user.phoneNumber,
      `Encontré *${providers.length}* prestador(es) disponible(s):`,
      'Ver prestadores',
      providersList
    );

    conversation.data.availableProviders = providers;
    conversation.setState('awaiting_provider_selection');

  } else {
    await twilioService.sendMessage(
      user.phoneNumber,
      '❌ Por favor comparte tu ubicación usando el botón de ubicación de WhatsApp.\n\n' +
      'Presiona 📎 → Ubicación'
    );
  }
}

/**
 * Maneja la selección del prestador
 */
async function handleProviderSelection(user, conversation, input, inputType) {
  if (inputType === 'list' || input.startsWith('provider_')) {
    const providerId = input.replace('provider_', '');
    const selectedProvider = conversation.data.availableProviders.find(
      p => p._id.toString() === providerId
    );

    if (!selectedProvider) {
      await twilioService.sendMessage(
        user.phoneNumber,
        '❌ Prestador no encontrado. Por favor selecciona uno de la lista.'
      );
      return;
    }

    conversation.data.selectedProvider = selectedProvider;

    await twilioService.sendMessage(
      user.phoneNumber,
      `✅ Has seleccionado a *${selectedProvider.name}*\n\n` +
      `⭐ Calificación: ${selectedProvider.rating}/5.0\n` +
      `💰 Tarifa: $${selectedProvider.hourlyRate}/hora\n` +
      `📍 Distancia: ${selectedProvider.distance.toFixed(1)} km\n\n` +
      'Por favor describe el problema o servicio que necesitas:'
    );

    conversation.setState('awaiting_problem_description');
  }
}

/**
 * Maneja la descripción del problema
 */
async function handleProblemDescription(user, conversation, input) {
  conversation.data.problemDescription = input;

  // Crear el ticket en la base de datos
  const ticket = await Ticket.create({
    client: user._id,
    provider: conversation.data.selectedProvider._id,
    category: conversation.data.detectedCategory,
    description: input,
    location: conversation.data.clientLocation,
    urgency: conversation.data.urgency,
    status: 'pending',
    pricing: {
      hourlyRate: conversation.data.selectedProvider.hourlyRate,
      depositAmount: parseFloat(process.env.DEPOSIT_AMOUNT) || 20
    }
  });

  conversation.data.ticketId = ticket._id;

  // Generar link de pago
  const paymentService = require('../services/paymentService');
  const paymentLink = await paymentService.createDepositPayment(
    ticket._id,
    ticket.pricing.depositAmount,
    user
  );

  await twilioService.sendMessage(
    user.phoneNumber,
    `📋 *Resumen de tu solicitud:*\n\n` +
    `👨‍🔧 Prestador: ${conversation.data.selectedProvider.name}\n` +
    `🔧 Servicio: ${conversation.data.detectedCategory}\n` +
    `💰 Tarifa: $${conversation.data.selectedProvider.hourlyRate}/hora\n` +
    `📍 Ubicación: ${conversation.data.clientLocation.latitude}, ${conversation.data.clientLocation.longitude}\n` +
    `📝 Descripción: ${input}\n\n` +
    `Para confirmar tu solicitud, realiza un depósito de garantía de *$${ticket.pricing.depositAmount}*:\n\n` +
    `💳 ${paymentLink}\n\n` +
    `Una vez confirmado el pago, notificaremos al prestador.`
  );

  conversation.setState('awaiting_payment');
}

/**
 * Maneja mensajes durante un servicio en progreso
 */
async function handleServiceInProgress(user, conversation, input) {
  // El cliente puede chatear con el prestador o hacer consultas
  const ticket = await Ticket.findById(conversation.data.ticketId);

  if (!ticket) {
    await twilioService.sendMessage(
      user.phoneNumber,
      '❌ No se encontró el servicio activo.'
    );
    conversation.setState('idle');
    return;
  }

  // Reenviar mensaje al prestador
  const Provider = require('../models/User');
  const provider = await Provider.findById(ticket.provider);

  await twilioService.sendMessage(
    provider.phoneNumber,
    `💬 Mensaje del cliente ${user.name}:\n\n${input}`
  );

  await twilioService.sendMessage(
    user.phoneNumber,
    '✅ Mensaje enviado al prestador.'
  );
}

/**
 * Maneja la calificación del servicio
 */
async function handleRating(user, conversation, input, inputType) {
  // Implementar lógica de calificación
  // Esta sección se desarrollaría completamente en producción
  await twilioService.sendMessage(
    user.phoneNumber,
    '⭐ Gracias por tu calificación. ¡Esperamos verte pronto!'
  );

  conversation.setState('idle');
}

/**
 * Maneja respuesta del prestador a una solicitud de trabajo
 */
async function handleProviderJobResponse(user, conversation, input, inputType) {
  const providersService = require('../services/providersService');
  await providersService.handleJobResponse(user, conversation, input);
}

/**
 * Maneja mensajes del prestador en estado idle
 */
async function handleProviderIdleMessage(user, conversation, input) {
  await twilioService.sendMessage(
    user.phoneNumber,
    '👋 Hola! Estás registrado como prestador de servicios.\n\n' +
    'Te notificaremos cuando haya nuevas solicitudes de trabajo en tu área.'
  );
}

/**
 * Maneja actualizaciones de estado de mensajes
 */
exports.handleStatusUpdate = async (req, res) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode } = req.body;

    logger.info(`📊 Estado del mensaje ${MessageSid}: ${MessageStatus}`);

    if (ErrorCode) {
      logger.error(`❌ Error en mensaje ${MessageSid}: ${ErrorCode}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error al procesar actualización de estado:', error);
    res.status(500).send('Error');
  }
};
