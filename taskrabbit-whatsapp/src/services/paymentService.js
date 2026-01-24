const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../utils/logger');
const Ticket = require('../models/Ticket');

/**
 * Crea un Payment Intent de Stripe para el depósito
 */
exports.createDepositPayment = async (ticketId, amount, user) => {
  try {
    // Convertir a centavos (Stripe usa centavos)
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: user.preferences?.currency?.toLowerCase() || 'mxn',
      metadata: {
        ticketId: ticketId.toString(),
        userId: user._id.toString(),
        type: 'deposit'
      },
      description: `Depósito de garantía - Ticket ${ticketId}`,
      automatic_payment_methods: {
        enabled: true,
      }
    });

    // Actualizar el ticket con el Payment Intent ID
    await Ticket.findByIdAndUpdate(ticketId, {
      'payment.depositPaymentIntentId': paymentIntent.id
    });

    // Generar link de pago (Stripe Checkout o Payment Link)
    const paymentLink = await exports.createStripePaymentLink(
      amountInCents,
      user.preferences?.currency?.toLowerCase() || 'mxn',
      ticketId,
      'deposit'
    );

    logger.info(`💳 Payment Intent creado: ${paymentIntent.id}`);

    return paymentLink;

  } catch (error) {
    logger.error('Error al crear Payment Intent:', error);
    throw error;
  }
};

/**
 * Crea un Payment Link de Stripe (más fácil para WhatsApp)
 */
exports.createStripePaymentLink = async (amountInCents, currency, ticketId, type) => {
  try {
    // Crear un producto temporal
    const product = await stripe.products.create({
      name: type === 'deposit' ? 'Depósito de Garantía' : 'Pago de Servicio',
      metadata: {
        ticketId: ticketId.toString(),
        type
      }
    });

    // Crear un precio para el producto
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: amountInCents,
      currency: currency,
    });

    // Crear el Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      metadata: {
        ticketId: ticketId.toString(),
        type
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.WEBHOOK_URL || 'https://yourdomain.com'}/payment/success?ticket=${ticketId}`
        }
      }
    });

    return paymentLink.url;

  } catch (error) {
    logger.error('Error al crear Payment Link:', error);
    throw error;
  }
};

/**
 * Crea el pago final del servicio (después de completar el trabajo)
 */
exports.createFinalPayment = async (ticketId, totalAmount, user) => {
  try {
    const amountInCents = Math.round(totalAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: user.preferences?.currency?.toLowerCase() || 'mxn',
      metadata: {
        ticketId: ticketId.toString(),
        userId: user._id.toString(),
        type: 'final_payment'
      },
      description: `Pago final de servicio - Ticket ${ticketId}`
    });

    await Ticket.findByIdAndUpdate(ticketId, {
      'payment.finalPaymentIntentId': paymentIntent.id
    });

    const paymentLink = await exports.createStripePaymentLink(
      amountInCents,
      user.preferences?.currency?.toLowerCase() || 'mxn',
      ticketId,
      'final'
    );

    return paymentLink;

  } catch (error) {
    logger.error('Error al crear pago final:', error);
    throw error;
  }
};

/**
 * Procesa un reembolso
 */
exports.processRefund = async (ticketId, reason = 'requested_by_customer') => {
  try {
    const ticket = await Ticket.findById(ticketId);

    if (!ticket || !ticket.payment.depositPaymentIntentId) {
      throw new Error('Ticket o Payment Intent no encontrado');
    }

    // Calcular porcentaje de reembolso basado en el estado
    const refundPercentage = ticket.calculateRefundPercentage();

    if (refundPercentage === 0) {
      logger.info('No hay reembolso disponible para este ticket');
      return null;
    }

    const refundAmount = Math.round(
      ticket.pricing.depositAmount * (refundPercentage / 100) * 100
    ); // En centavos

    const refund = await stripe.refunds.create({
      payment_intent: ticket.payment.depositPaymentIntentId,
      amount: refundAmount,
      reason,
      metadata: {
        ticketId: ticketId.toString(),
        refundPercentage
      }
    });

    // Actualizar ticket
    await Ticket.findByIdAndUpdate(ticketId, {
      'payment.refundId': refund.id,
      'payment.refundAmount': refundAmount / 100,
      'payment.refundReason': reason,
      'payment.refundedAt': new Date(),
      'payment.depositStatus': 'refunded'
    });

    logger.info(`💰 Reembolso procesado: ${refund.id} - $${refundAmount / 100}`);

    return refund;

  } catch (error) {
    logger.error('Error al procesar reembolso:', error);
    throw error;
  }
};

/**
 * Transfiere fondos al prestador (después de completar el servicio)
 */
exports.transferToProvider = async (ticketId) => {
  try {
    const ticket = await Ticket.findById(ticketId).populate('provider');

    if (!ticket || ticket.status !== 'completed') {
      throw new Error('Ticket no válido o no completado');
    }

    if (!ticket.provider.providerInfo?.bankInfo?.accountNumber) {
      throw new Error('Prestador no tiene información bancaria');
    }

    // En producción, aquí usarías Stripe Connect para transferir directamente
    // Por ahora, solo marcamos el pago como procesado

    // Ejemplo con Stripe Connect (requiere configuración adicional):
    /*
    const transfer = await stripe.transfers.create({
      amount: Math.round(ticket.pricing.providerEarnings * 100),
      currency: 'mxn',
      destination: ticket.provider.stripeConnectAccountId,
      metadata: {
        ticketId: ticketId.toString()
      }
    });
    */

    logger.info(`💸 Transferencia programada para prestador: $${ticket.pricing.providerEarnings}`);

    return {
      amount: ticket.pricing.providerEarnings,
      status: 'pending', // En producción sería 'completed'
      provider: ticket.provider._id
    };

  } catch (error) {
    logger.error('Error al transferir fondos:', error);
    throw error;
  }
};

/**
 * Maneja el webhook de Stripe para confirmaciones de pago
 */
exports.handleStripeWebhook = async (event) => {
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await exports.handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await exports.handlePaymentFailure(event.data.object);
        break;

      case 'charge.refunded':
        await exports.handleRefundCompleted(event.data.object);
        break;

      default:
        logger.info(`Evento de Stripe no manejado: ${event.type}`);
    }

    return { received: true };

  } catch (error) {
    logger.error('Error al procesar webhook de Stripe:', error);
    throw error;
  }
};

/**
 * Maneja pago exitoso
 */
exports.handlePaymentSuccess = async (paymentIntent) => {
  try {
    const ticketId = paymentIntent.metadata.ticketId;
    const paymentType = paymentIntent.metadata.type;

    logger.info(`✅ Pago exitoso para ticket ${ticketId} - Tipo: ${paymentType}`);

    if (paymentType === 'deposit') {
      // Actualizar estado del depósito
      await Ticket.findByIdAndUpdate(ticketId, {
        'payment.depositStatus': 'completed',
        'payment.depositPaidAt': new Date(),
        status: 'pending' // Ahora puede notificar al prestador
      });

      // Aquí se dispararía la notificación al prestador
      const providersService = require('./providersService');
      await providersService.notifyProviderOfNewJob(ticketId);

    } else if (paymentType === 'final_payment') {
      // Pago final completado
      await Ticket.findByIdAndUpdate(ticketId, {
        'payment.finalPaymentStatus': 'completed',
        'payment.finalPaymentPaidAt': new Date()
      });

      // Transferir fondos al prestador
      await exports.transferToProvider(ticketId);
    }

  } catch (error) {
    logger.error('Error al manejar pago exitoso:', error);
  }
};

/**
 * Maneja pago fallido
 */
exports.handlePaymentFailure = async (paymentIntent) => {
  try {
    const ticketId = paymentIntent.metadata.ticketId;
    const paymentType = paymentIntent.metadata.type;

    logger.error(`❌ Pago fallido para ticket ${ticketId} - Tipo: ${paymentType}`);

    if (paymentType === 'deposit') {
      await Ticket.findByIdAndUpdate(ticketId, {
        'payment.depositStatus': 'failed'
      });

      // Notificar al cliente del fallo
      const ticket = await Ticket.findById(ticketId).populate('client');
      const twilioService = require('./twilioService');

      await twilioService.sendMessage(
        ticket.client.phoneNumber,
        '❌ El pago no se pudo procesar. Por favor intenta nuevamente con otro método de pago.'
      );
    }

  } catch (error) {
    logger.error('Error al manejar pago fallido:', error);
  }
};

/**
 * Maneja reembolso completado
 */
exports.handleRefundCompleted = async (charge) => {
  logger.info(`💰 Reembolso completado: ${charge.id}`);
  // Aquí se podría notificar al cliente
};

/**
 * Alternativa: MercadoPago para LATAM
 */
exports.createMercadoPagoPayment = async (ticketId, amount, user) => {
  // Este es un ejemplo básico, requiere el SDK de MercadoPago
  try {
    const mercadopago = require('mercadopago');

    mercadopago.configure({
      access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
    });

    const preference = {
      items: [
        {
          title: 'Depósito de garantía',
          unit_price: amount,
          quantity: 1,
        }
      ],
      back_urls: {
        success: `${process.env.WEBHOOK_URL}/payment/success`,
        failure: `${process.env.WEBHOOK_URL}/payment/failure`,
        pending: `${process.env.WEBHOOK_URL}/payment/pending`
      },
      auto_return: 'approved',
      external_reference: ticketId.toString(),
      metadata: {
        ticket_id: ticketId.toString()
      }
    };

    const response = await mercadopago.preferences.create(preference);

    return response.body.init_point; // URL de pago

  } catch (error) {
    logger.error('Error al crear preferencia de MercadoPago:', error);
    throw error;
  }
};

module.exports = exports;
