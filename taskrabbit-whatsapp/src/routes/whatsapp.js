const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { verifyWebhook } = require('../middleware/webhookVerification');

/**
 * GET /webhook/whatsapp
 * Verificación del webhook (requerido por Twilio/Meta)
 */
router.get('/', verifyWebhook);

/**
 * POST /webhook/whatsapp
 * Recepción de mensajes entrantes de WhatsApp
 */
router.post('/', whatsappController.handleIncomingMessage);

/**
 * POST /webhook/whatsapp/status
 * Actualizaciones de estado de mensajes enviados
 */
router.post('/status', whatsappController.handleStatusUpdate);

module.exports = router;
