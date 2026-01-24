const User = require('../models/User');
const Ticket = require('../models/Ticket');
const googleMapsService = require('./googleMapsService');
const twilioService = require('./twilioService');
const logger = require('../utils/logger');

/**
 * Busca prestadores cercanos disponibles
 */
exports.findNearbyProviders = async ({ category, latitude, longitude, radius = 10 }) => {
  try {
    // Buscar prestadores usando índice geoespacial
    const providers = await User.find({
      role: 'provider',
      status: 'active',
      'providerInfo.availability': 'available',
      'providerInfo.categories': category,
      'providerInfo.verification.backgroundCheck.status': 'approved',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radius * 1000 // convertir km a metros
        }
      }
    })
    .select('name phoneNumber providerInfo location')
    .limit(10);

    // Calcular distancia exacta usando Haversine
    const providersWithDistance = providers.map(provider => {
      const distance = googleMapsService.haversineDistance(
        latitude,
        longitude,
        provider.location.coordinates[1], // lat
        provider.location.coordinates[0]  // lng
      );

      return {
        _id: provider._id,
        name: provider.name,
        phoneNumber: provider.phoneNumber,
        rating: provider.providerInfo.rating,
        reviewsCount: provider.providerInfo.reviewsCount,
        hourlyRate: provider.providerInfo.hourlyRate,
        distance: distance,
        location: provider.location,
        acceptsEmergencies: provider.providerInfo.acceptsEmergencies
      };
    });

    // Ordenar por rating y distancia
    providersWithDistance.sort((a, b) => {
      // Priorizar rating, luego distancia
      if (Math.abs(a.rating - b.rating) > 0.5) {
        return b.rating - a.rating; // Mayor rating primero
      }
      return a.distance - b.distance; // Menor distancia primero
    });

    logger.info(`🔍 Encontrados ${providersWithDistance.length} prestadores para ${category}`);

    return providersWithDistance;

  } catch (error) {
    logger.error('Error al buscar prestadores:', error);
    throw error;
  }
};

/**
 * Notifica a un prestador sobre un nuevo trabajo
 */
exports.notifyProviderOfNewJob = async (ticketId) => {
  try {
    const ticket = await Ticket.findById(ticketId)
      .populate('client')
      .populate('provider');

    if (!ticket) {
      throw new Error('Ticket no encontrado');
    }

    // Obtener dirección desde coordenadas
    const address = await googleMapsService.reverseGeocode(
      ticket.location.coordinates[1],
      ticket.location.coordinates[0]
    );

    // Calcular distancia al prestador
    const distance = googleMapsService.haversineDistance(
      ticket.location.coordinates[1],
      ticket.location.coordinates[0],
      ticket.provider.location.coordinates[1],
      ticket.provider.location.coordinates[0]
    );

    // Generar link de Google Maps
    const mapLink = googleMapsService.generateMapLink(
      ticket.location.coordinates[1],
      ticket.location.coordinates[0],
      'Ubicación del cliente'
    );

    // Enviar notificación al prestador
    const message =
      `🔔 *Nueva solicitud de trabajo*\n\n` +
      `👤 Cliente: ${ticket.client.name}\n` +
      `🔧 Servicio: ${ticket.category}\n` +
      `📍 Ubicación: ${address.formattedAddress}\n` +
      `📏 Distancia: ${distance.toFixed(1)} km de tu ubicación\n` +
      `💰 Pago: $${ticket.pricing.hourlyRate}/hora\n` +
      `📝 Descripción: "${ticket.description}"\n\n` +
      `🗺️ Ver en mapa: ${mapLink}\n\n` +
      `¿Aceptas este trabajo?\n` +
      `1. ✅ Aceptar\n` +
      `2. ❌ Rechazar`;

    await twilioService.sendMessage(ticket.provider.phoneNumber, message);

    // Registrar notificación en el ticket
    await Ticket.findByIdAndUpdate(ticketId, {
      $push: {
        notifiedProviders: {
          provider: ticket.provider._id,
          notifiedAt: new Date(),
          responded: false
        }
      }
    });

    // Actualizar conversación del prestador
    const conversationManager = require('./conversationManager');
    const conversation = await conversationManager.getConversation(ticket.provider.phoneNumber);

    conversation.setState('provider_awaiting_job_response');
    conversation.data.pendingTicketId = ticketId;

    logger.info(`📨 Prestador notificado: ${ticket.provider.name}`);

  } catch (error) {
    logger.error('Error al notificar prestador:', error);
    throw error;
  }
};

/**
 * Maneja la respuesta del prestador a una solicitud de trabajo
 */
exports.handleJobResponse = async (provider, conversation, response) => {
  try {
    const ticketId = conversation.data.pendingTicketId;

    if (!ticketId) {
      await twilioService.sendMessage(
        provider.phoneNumber,
        '❌ No hay solicitudes de trabajo pendientes.'
      );
      return;
    }

    const ticket = await Ticket.findById(ticketId).populate('client');

    if (!ticket) {
      await twilioService.sendMessage(
        provider.phoneNumber,
        '❌ Solicitud no encontrada.'
      );
      conversation.setState('idle');
      return;
    }

    // Verificar respuesta
    const accepted = response === '1' ||
                     response.toLowerCase().includes('aceptar') ||
                     response.toLowerCase().includes('sí') ||
                     response.toLowerCase().includes('si');

    if (accepted) {
      // ACEPTAR TRABAJO
      await ticket.accept(provider._id);

      // Actualizar disponibilidad del prestador
      await User.findByIdAndUpdate(provider._id, {
        'providerInfo.availability': 'busy'
      });

      // Obtener información de contacto del cliente
      const clientAddress = await googleMapsService.reverseGeocode(
        ticket.location.coordinates[1],
        ticket.location.coordinates[0]
      );

      // Calcular ETA
      const eta = await googleMapsService.getETA(
        {
          latitude: provider.location.coordinates[1],
          longitude: provider.location.coordinates[0]
        },
        {
          latitude: ticket.location.coordinates[1],
          longitude: ticket.location.coordinates[0]
        }
      );

      // Enviar confirmación al prestador
      await twilioService.sendMessage(
        provider.phoneNumber,
        `✅ *Perfecto! El cliente ha sido notificado.*\n\n` +
        `📞 *Contacto del cliente:*\n` +
        `Nombre: ${ticket.client.name}\n` +
        `Teléfono: ${ticket.client.phoneNumber}\n` +
        `Ubicación: ${clientAddress.formattedAddress}\n\n` +
        `⏱️ Tiempo estimado de llegada: ${eta.duration.text}\n\n` +
        `Puedes contactar directamente al cliente o enviar mensajes aquí.`
      );

      // Notificar al cliente
      await twilioService.sendMessage(
        ticket.client.phoneNumber,
        `✅ *¡Buenas noticias!*\n\n` +
        `${provider.name} ha aceptado tu solicitud.\n\n` +
        `📞 Teléfono: ${provider.phoneNumber}\n` +
        `⭐ Calificación: ${provider.providerInfo.rating}/5.0\n` +
        `⏱️ Llegará aproximadamente en: ${eta.duration.text}\n\n` +
        `Puedes contactarlo directamente o enviar mensajes aquí.`
      );

      // Actualizar estados
      conversation.setState('service_in_progress');
      conversation.data.activeTicketId = ticketId;
      delete conversation.data.pendingTicketId;

      // Actualizar conversación del cliente
      const clientConversation = await conversationManager.getConversation(
        ticket.client.phoneNumber
      );
      clientConversation.setState('service_in_progress');
      clientConversation.data.activeTicketId = ticketId;

    } else {
      // RECHAZAR TRABAJO
      await Ticket.findByIdAndUpdate(ticketId, {
        $push: {
          rejectedBy: {
            provider: provider._id,
            rejectedAt: new Date(),
            reason: 'Provider declined'
          }
        }
      });

      await twilioService.sendMessage(
        provider.phoneNumber,
        '✅ Entendido. Hemos rechazado el trabajo.'
      );

      conversation.setState('idle');
      delete conversation.data.pendingTicketId;

      // Buscar siguiente prestador disponible
      await exports.notifyNextProvider(ticketId);
    }

  } catch (error) {
    logger.error('Error al manejar respuesta de prestador:', error);
    await twilioService.sendMessage(
      provider.phoneNumber,
      '❌ Ocurrió un error al procesar tu respuesta. Por favor intenta nuevamente.'
    );
  }
};

/**
 * Notifica al siguiente prestador en la lista
 */
exports.notifyNextProvider = async (ticketId) => {
  try {
    const ticket = await Ticket.findById(ticketId).populate('client');

    if (!ticket) {
      throw new Error('Ticket no encontrado');
    }

    // Obtener IDs de prestadores ya notificados
    const notifiedIds = ticket.notifiedProviders.map(n => n.provider.toString());
    const rejectedIds = ticket.rejectedBy.map(r => r.provider.toString());
    const excludedIds = [...new Set([...notifiedIds, ...rejectedIds])];

    // Buscar siguiente prestador
    const nextProviders = await exports.findNearbyProviders({
      category: ticket.category,
      latitude: ticket.location.coordinates[1],
      longitude: ticket.location.coordinates[0],
      radius: 20 // Ampliar radio
    });

    // Filtrar prestadores ya contactados
    const availableProvider = nextProviders.find(
      p => !excludedIds.includes(p._id.toString())
    );

    if (availableProvider) {
      // Actualizar ticket con nuevo prestador
      await Ticket.findByIdAndUpdate(ticketId, {
        provider: availableProvider._id
      });

      // Notificar al siguiente prestador
      await exports.notifyProviderOfNewJob(ticketId);

    } else {
      // No hay más prestadores disponibles
      logger.warn(`⚠️ No hay más prestadores disponibles para ticket ${ticketId}`);

      await twilioService.sendMessage(
        ticket.client.phoneNumber,
        '😔 Lo sentimos, no encontramos prestadores disponibles en este momento.\n\n' +
        '¿Deseas ampliar el radio de búsqueda o intentar más tarde?'
      );
    }

  } catch (error) {
    logger.error('Error al notificar siguiente prestador:', error);
  }
};

/**
 * Obtiene estadísticas de un prestador
 */
exports.getProviderStats = async (providerId) => {
  try {
    const provider = await User.findById(providerId);

    if (!provider || provider.role !== 'provider') {
      throw new Error('Prestador no encontrado');
    }

    const completedJobs = await Ticket.countDocuments({
      provider: providerId,
      status: 'completed'
    });

    const totalEarnings = await Ticket.aggregate([
      {
        $match: {
          provider: providerId,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.providerEarnings' }
        }
      }
    ]);

    return {
      name: provider.name,
      rating: provider.providerInfo.rating,
      reviewsCount: provider.providerInfo.reviewsCount,
      completedJobs,
      totalEarnings: totalEarnings[0]?.total || 0,
      categories: provider.providerInfo.categories,
      joinedDate: provider.createdAt
    };

  } catch (error) {
    logger.error('Error al obtener estadísticas de prestador:', error);
    throw error;
  }
};

module.exports = exports;
