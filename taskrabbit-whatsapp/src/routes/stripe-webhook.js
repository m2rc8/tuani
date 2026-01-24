const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paymentService = require('../services/paymentService');
const logger = require('../utils/logger');

/**
 * POST /webhook/stripe
 * Webhook para eventos de Stripe
 */
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verificar firma del webhook
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    logger.info(`📨 Webhook de Stripe recibido: ${event.type}`);

    // Procesar el evento
    await paymentService.handleStripeWebhook(event);

    // Responder a Stripe
    res.json({ received: true });

  } catch (err) {
    logger.error(`❌ Error en webhook de Stripe: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;
