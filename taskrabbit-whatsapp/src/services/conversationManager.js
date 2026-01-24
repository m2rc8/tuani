const Conversation = require('../models/Conversation');
const logger = require('../utils/logger');

/**
 * Obtiene o crea una conversación para un número de teléfono
 */
exports.getConversation = async (phoneNumber) => {
  try {
    let conversation = await Conversation.findOne({ phoneNumber });

    if (!conversation) {
      conversation = await exports.createConversation(phoneNumber);
    }

    // Actualizar última actividad
    conversation.lastActivity = new Date();
    await conversation.save();

    return conversation;

  } catch (error) {
    logger.error('Error al obtener conversación:', error);
    throw error;
  }
};

/**
 * Crea una nueva conversación
 */
exports.createConversation = async (phoneNumber, userId = null) => {
  try {
    const conversation = await Conversation.create({
      phoneNumber,
      user: userId,
      state: 'idle',
      data: {},
      messages: []
    });

    logger.info(`📝 Nueva conversación creada para ${phoneNumber}`);

    return conversation;

  } catch (error) {
    logger.error('Error al crear conversación:', error);
    throw error;
  }
};

/**
 * Actualiza el estado de la conversación
 */
exports.updateState = async (phoneNumber, newState, data = {}) => {
  try {
    const conversation = await Conversation.findOne({ phoneNumber });

    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    conversation.state = newState;
    conversation.data = { ...conversation.data, ...data };
    conversation.lastActivity = new Date();

    await conversation.save();

    logger.info(`🔄 Estado actualizado para ${phoneNumber}: ${newState}`);

    return conversation;

  } catch (error) {
    logger.error('Error al actualizar estado:', error);
    throw error;
  }
};

/**
 * Agrega un mensaje al historial de la conversación
 */
exports.addMessage = async (phoneNumber, role, content, type = 'text', metadata = {}) => {
  try {
    const conversation = await Conversation.findOne({ phoneNumber });

    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    await conversation.addMessage(role, content, type, metadata);

    return conversation;

  } catch (error) {
    logger.error('Error al agregar mensaje:', error);
    throw error;
  }
};

/**
 * Obtiene el contexto de la conversación para OpenAI
 */
exports.getContext = async (phoneNumber, lastN = 10) => {
  try {
    const conversation = await Conversation.findOne({ phoneNumber });

    if (!conversation) {
      return [];
    }

    return conversation.getContext(lastN);

  } catch (error) {
    logger.error('Error al obtener contexto:', error);
    return [];
  }
};

/**
 * Reinicia una conversación
 */
exports.resetConversation = async (phoneNumber) => {
  try {
    const conversation = await Conversation.findOne({ phoneNumber });

    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    await conversation.resetConversation();

    logger.info(`🔄 Conversación reiniciada para ${phoneNumber}`);

    return conversation;

  } catch (error) {
    logger.error('Error al reiniciar conversación:', error);
    throw error;
  }
};

/**
 * Limpia conversaciones inactivas (cron job)
 */
exports.cleanupInactiveConversations = async (daysInactive = 30) => {
  try {
    const result = await Conversation.cleanupInactive(daysInactive);

    logger.info(`🧹 Limpieza de conversaciones: ${result.deletedCount} eliminadas`);

    return result;

  } catch (error) {
    logger.error('Error al limpiar conversaciones:', error);
    throw error;
  }
};

/**
 * Obtiene todas las conversaciones activas
 */
exports.getActiveConversations = async () => {
  try {
    const conversations = await Conversation.find({
      state: { $ne: 'idle' },
      lastActivity: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
      }
    }).populate('user');

    return conversations;

  } catch (error) {
    logger.error('Error al obtener conversaciones activas:', error);
    throw error;
  }
};

module.exports = exports;
