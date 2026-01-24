const twilio = require('twilio');
const logger = require('../utils/logger');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

/**
 * Envía un mensaje de texto simple
 */
exports.sendMessage = async (to, message) => {
  try {
    const result = await client.messages.create({
      from: WHATSAPP_NUMBER,
      to: `whatsapp:${to}`,
      body: message
    });

    logger.info(`📤 Mensaje enviado a ${to}: ${result.sid}`);
    return result;
  } catch (error) {
    logger.error(`Error al enviar mensaje a ${to}:`, error);
    throw error;
  }
};

/**
 * Envía un mensaje con botones de respuesta rápida
 * Nota: WhatsApp Business API tiene limitaciones con botones
 */
exports.sendMessageWithButtons = async (to, message, buttons) => {
  try {
    // Twilio WhatsApp actualmente no soporta botones interactivos directamente
    // Alternativa: enviar mensaje con opciones numeradas
    let formattedMessage = message + '\n\n';

    buttons.forEach((button, index) => {
      formattedMessage += `${index + 1}. ${button.title}\n`;
    });

    formattedMessage += '\nResponde con el número de tu elección.';

    return await exports.sendMessage(to, formattedMessage);
  } catch (error) {
    logger.error('Error al enviar mensaje con botones:', error);
    throw error;
  }
};

/**
 * Envía una lista interactiva
 * Nota: Para listas verdaderas, necesitas usar la API de Meta directamente
 */
exports.sendList = async (to, message, buttonText, items) => {
  try {
    // Formatear como lista numerada
    let formattedMessage = message + '\n\n';

    items.forEach((item, index) => {
      formattedMessage += `${index + 1}. *${item.title}*\n`;
      if (item.description) {
        formattedMessage += `   ${item.description}\n`;
      }
      formattedMessage += '\n';
    });

    formattedMessage += `Responde con el número del ${buttonText.toLowerCase()}.`;

    return await exports.sendMessage(to, formattedMessage);
  } catch (error) {
    logger.error('Error al enviar lista:', error);
    throw error;
  }
};

/**
 * Solicita que el usuario comparta su ubicación
 */
exports.sendLocationRequest = async (to, message) => {
  try {
    // WhatsApp no tiene un botón específico de ubicación via API
    // El usuario debe compartirlo manualmente
    return await exports.sendMessage(
      to,
      message + '\n\n📍 Por favor presiona el ícono de adjuntar (📎) y selecciona "Ubicación".'
    );
  } catch (error) {
    logger.error('Error al solicitar ubicación:', error);
    throw error;
  }
};

/**
 * Envía una imagen con caption
 */
exports.sendImage = async (to, imageUrl, caption = '') => {
  try {
    const result = await client.messages.create({
      from: WHATSAPP_NUMBER,
      to: `whatsapp:${to}`,
      body: caption,
      mediaUrl: [imageUrl]
    });

    logger.info(`📤 Imagen enviada a ${to}: ${result.sid}`);
    return result;
  } catch (error) {
    logger.error(`Error al enviar imagen a ${to}:`, error);
    throw error;
  }
};

/**
 * Envía un documento/archivo
 */
exports.sendDocument = async (to, documentUrl, caption = '') => {
  try {
    const result = await client.messages.create({
      from: WHATSAPP_NUMBER,
      to: `whatsapp:${to}`,
      body: caption,
      mediaUrl: [documentUrl]
    });

    logger.info(`📤 Documento enviado a ${to}: ${result.sid}`);
    return result;
  } catch (error) {
    logger.error(`Error al enviar documento a ${to}:`, error);
    throw error;
  }
};

/**
 * Envía una plantilla de WhatsApp aprobada
 * (Para notificaciones fuera de la ventana de 24 horas)
 */
exports.sendTemplate = async (to, templateName, parameters = []) => {
  try {
    // Las plantillas deben estar pre-aprobadas en Twilio/Meta
    const result = await client.messages.create({
      from: WHATSAPP_NUMBER,
      to: `whatsapp:${to}`,
      contentSid: templateName, // Template SID de Twilio
      contentVariables: JSON.stringify(parameters)
    });

    logger.info(`📤 Template enviado a ${to}: ${result.sid}`);
    return result;
  } catch (error) {
    logger.error(`Error al enviar template a ${to}:`, error);
    throw error;
  }
};

/**
 * Verifica el estado de entrega de un mensaje
 */
exports.getMessageStatus = async (messageSid) => {
  try {
    const message = await client.messages(messageSid).fetch();
    return {
      status: message.status,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage
    };
  } catch (error) {
    logger.error(`Error al obtener estado del mensaje ${messageSid}:`, error);
    throw error;
  }
};

/**
 * Envía múltiples mensajes con delay para evitar spam
 */
exports.sendBulkMessages = async (messages, delayMs = 1000) => {
  const results = [];

  for (const msg of messages) {
    try {
      const result = await exports.sendMessage(msg.to, msg.body);
      results.push({ success: true, to: msg.to, sid: result.sid });

      // Delay entre mensajes
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      results.push({ success: false, to: msg.to, error: error.message });
    }
  }

  return results;
};

module.exports = exports;
