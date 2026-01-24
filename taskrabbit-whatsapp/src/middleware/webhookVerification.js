const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Verifica la autenticidad del webhook de Twilio/Meta
 *
 * Para Twilio: Usa el método GET con hub.mode, hub.verify_token, hub.challenge
 * Para Meta: Similar proceso de verificación
 */
exports.verifyWebhook = (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logger.info('🔐 Verificación de webhook recibida');

    // Verificar que el modo y token sean correctos
    if (mode && token) {
      if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        logger.info('✅ Webhook verificado exitosamente');
        res.status(200).send(challenge);
      } else {
        logger.error('❌ Token de verificación incorrecto');
        res.sendStatus(403);
      }
    } else {
      logger.error('❌ Parámetros de verificación faltantes');
      res.sendStatus(400);
    }
  } catch (error) {
    logger.error('Error en verificación de webhook:', error);
    res.sendStatus(500);
  }
};

/**
 * Valida la firma X-Twilio-Signature para asegurar que el request viene de Twilio
 *
 * @param {Object} req - Request de Express
 * @returns {boolean} - True si la firma es válida
 */
exports.validateTwilioSignature = (req) => {
  try {
    const signature = req.headers['x-twilio-signature'];

    if (!signature) {
      logger.warn('⚠️ Signature de Twilio no encontrada en headers');
      return false;
    }

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    // Construir el string que Twilio firma
    let data = url;
    Object.keys(req.body).sort().forEach((key) => {
      data += key + req.body[key];
    });

    // Generar la firma esperada
    const expectedSignature = crypto
      .createHmac('sha1', authToken)
      .update(Buffer.from(data, 'utf-8'))
      .digest('base64');

    // Comparar
    const isValid = signature === expectedSignature;

    if (!isValid) {
      logger.warn('⚠️ Firma de Twilio inválida');
    }

    return isValid;

  } catch (error) {
    logger.error('Error al validar firma de Twilio:', error);
    return false;
  }
};

/**
 * Middleware para validar firma en requests POST
 */
exports.validateTwilioRequest = (req, res, next) => {
  // En desarrollo, podemos desactivar la validación
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_SIGNATURE_VALIDATION === 'true') {
    logger.warn('⚠️ Validación de firma desactivada (modo desarrollo)');
    return next();
  }

  const isValid = exports.validateTwilioSignature(req);

  if (!isValid) {
    logger.error('❌ Request rechazado: firma inválida');
    return res.status(403).json({ error: 'Firma inválida' });
  }

  next();
};
