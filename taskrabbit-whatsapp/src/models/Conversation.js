const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Estado actual de la conversación
  state: {
    type: String,
    default: 'idle',
    enum: [
      'idle',
      'awaiting_role_selection',
      'awaiting_name',
      'awaiting_category_confirmation',
      'awaiting_location',
      'awaiting_provider_selection',
      'awaiting_problem_description',
      'awaiting_payment',
      'awaiting_provider_response',
      'service_in_progress',
      'awaiting_rating',
      'provider_awaiting_job_response',
      'provider_registration'
    ]
  },

  // Datos temporales de la conversación
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Historial de mensajes
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant', 'system']
    },
    content: String,
    type: {
      type: String,
      enum: ['text', 'button', 'list', 'location', 'image']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: mongoose.Schema.Types.Mixed
  }],

  // Última actividad
  lastActivity: {
    type: Date,
    default: Date.now
  },

  // Ticket activo (si hay uno)
  activeTicket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices
conversationSchema.index({ lastActivity: 1 });
conversationSchema.index({ state: 1 });

// Métodos del esquema
conversationSchema.methods.setState = function(newState) {
  this.state = newState;
  this.lastActivity = new Date();
  return this.save();
};

conversationSchema.methods.addMessage = function(role, content, type = 'text', metadata = {}) {
  this.messages.push({
    role,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    type,
    timestamp: new Date(),
    metadata
  });
  this.lastActivity = new Date();

  // Mantener solo los últimos 50 mensajes para no sobrecargar la DB
  if (this.messages.length > 50) {
    this.messages = this.messages.slice(-50);
  }

  return this.save();
};

conversationSchema.methods.resetConversation = function() {
  this.state = 'idle';
  this.data = {};
  this.messages = [];
  this.activeTicket = null;
  this.lastActivity = new Date();
  return this.save();
};

conversationSchema.methods.getContext = function(lastN = 10) {
  // Retorna los últimos N mensajes para contexto de OpenAI
  return this.messages.slice(-lastN);
};

// Método estático para limpiar conversaciones inactivas
conversationSchema.statics.cleanupInactive = async function(daysInactive = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

  return this.deleteMany({
    lastActivity: { $lt: cutoffDate },
    state: 'idle'
  });
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
