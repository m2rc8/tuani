const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  // Referencias
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Información del servicio
  category: {
    type: String,
    required: true,
    enum: [
      'Plomería',
      'Electricidad',
      'Limpieza del hogar',
      'Limpieza de oficinas',
      'Carpintería',
      'Pintura',
      'Jardinería',
      'Mudanzas',
      'Reparación de electrodomésticos',
      'Cerrajería',
      'Instalación de aire acondicionado',
      'Reparación de computadoras',
      'Fumigación',
      'Albañilería',
      'Reparación de techos',
      'Instalación de pisos',
      'Reparación de muebles',
      'Servicio de planchado',
      'Cuidado de mascotas',
      'Cuidado de niños',
      'Cuidado de adultos mayores',
      'Clases particulares',
      'Entrenamiento personal',
      'Masajes',
      'Otros'
    ]
  },

  description: {
    type: String,
    required: true
  },

  // Ubicación del servicio
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: String
  },

  // Estado del ticket
  status: {
    type: String,
    enum: [
      'pending',        // Esperando aceptación del prestador
      'payment_pending', // Esperando pago del cliente
      'accepted',       // Prestador aceptó
      'en_route',       // Prestador en camino
      'in_progress',    // Servicio en curso
      'completed',      // Servicio completado
      'cancelled',      // Cancelado
      'disputed'        // En disputa
    ],
    default: 'pending',
    index: true
  },

  // Urgencia
  urgency: {
    type: String,
    enum: ['normal', 'urgente', 'emergencia'],
    default: 'normal'
  },

  // Precios
  pricing: {
    hourlyRate: {
      type: Number,
      required: true
    },
    depositAmount: {
      type: Number,
      required: true
    },
    estimatedHours: Number,
    actualHours: Number,
    tipAmount: {
      type: Number,
      default: 0
    },
    totalAmount: Number,
    platformFee: Number, // Comisión de la plataforma
    providerEarnings: Number // Lo que recibe el prestador
  },

  // Información de pago
  payment: {
    depositPaymentIntentId: String, // Stripe/MercadoPago Payment Intent ID
    depositStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    depositPaidAt: Date,

    finalPaymentIntentId: String,
    finalPaymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    finalPaymentPaidAt: Date,

    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundedAt: Date
  },

  // Timeline del servicio
  timeline: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    acceptedAt: Date,
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date
  },

  // Calificación y reseña
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    photos: [String],
    createdAt: Date
  },

  // Respuesta del prestador a la reseña
  providerResponse: {
    comment: String,
    createdAt: Date
  },

  // Historial de prestadores que rechazaron
  rejectedBy: [{
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejectedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],

  // Prestadores notificados (para tracking)
  notifiedProviders: [{
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notifiedAt: {
      type: Date,
      default: Date.now
    },
    responded: {
      type: Boolean,
      default: false
    }
  }],

  // Chat messages (opcional, para historial)
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    mediaUrl: String
  }],

  // Información de cancelación
  cancellation: {
    cancelledBy: {
      type: String,
      enum: ['client', 'provider', 'system', 'admin']
    },
    reason: String,
    refundPercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    cancelledAt: Date
  },

  // Información de disputa
  dispute: {
    reason: String,
    openedBy: {
      type: String,
      enum: ['client', 'provider']
    },
    openedAt: Date,
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'closed']
    },
    resolution: String,
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Fotos del trabajo completado
  completionPhotos: [{
    url: String,
    uploadedBy: {
      type: String,
      enum: ['client', 'provider']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Notas internas (admin)
  internalNotes: [{
    note: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Metadata
  metadata: {
    clientPlatform: String, // whatsapp, web, app
    clientVersion: String,
    ipAddress: String,
    userAgent: String
  }

}, {
  timestamps: true
});

// Índices
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ client: 1, status: 1 });
ticketSchema.index({ provider: 1, status: 1 });
ticketSchema.index({ location: '2dsphere' });
ticketSchema.index({ category: 1, status: 1 });

// Middleware pre-save para calcular totales
ticketSchema.pre('save', function(next) {
  if (this.status === 'completed' && this.pricing.actualHours) {
    // Calcular total
    const subtotal = this.pricing.hourlyRate * this.pricing.actualHours;
    const tip = this.pricing.tipAmount || 0;
    const total = subtotal + tip;

    // Calcular comisión de la plataforma (ej: 15%)
    const feePercentage = parseFloat(process.env.SERVICE_FEE_PERCENTAGE) || 15;
    const platformFee = subtotal * (feePercentage / 100);

    // Lo que recibe el prestador
    const providerEarnings = subtotal - platformFee + tip;

    this.pricing.totalAmount = total;
    this.pricing.platformFee = platformFee;
    this.pricing.providerEarnings = providerEarnings;
  }
  next();
});

// Métodos del esquema
ticketSchema.methods.accept = function(providerId) {
  this.provider = providerId;
  this.status = 'accepted';
  this.timeline.acceptedAt = new Date();
  return this.save();
};

ticketSchema.methods.start = function() {
  this.status = 'in_progress';
  this.timeline.startedAt = new Date();
  return this.save();
};

ticketSchema.methods.complete = function(actualHours) {
  this.status = 'completed';
  this.pricing.actualHours = actualHours;
  this.timeline.completedAt = new Date();
  return this.save();
};

ticketSchema.methods.cancel = function(cancelledBy, reason) {
  this.status = 'cancelled';
  this.cancellation = {
    cancelledBy,
    reason,
    cancelledAt: new Date(),
    refundPercentage: this.calculateRefundPercentage()
  };
  this.timeline.cancelledAt = new Date();
  return this.save();
};

ticketSchema.methods.calculateRefundPercentage = function() {
  if (!this.timeline.acceptedAt) {
    return 100; // Reembolso total si no fue aceptado
  }
  if (!this.timeline.startedAt) {
    return 50; // Reembolso parcial si fue aceptado pero no iniciado
  }
  return 0; // Sin reembolso si ya inició
};

ticketSchema.methods.addMessage = function(senderId, message, mediaUrl = null) {
  this.messages.push({
    sender: senderId,
    message,
    mediaUrl,
    timestamp: new Date()
  });
  return this.save();
};

// Métodos estáticos
ticketSchema.statics.getActiveTicketsForProvider = function(providerId) {
  return this.find({
    provider: providerId,
    status: { $in: ['accepted', 'en_route', 'in_progress'] }
  }).sort({ createdAt: -1 });
};

ticketSchema.statics.getTicketHistory = function(userId, role) {
  const query = role === 'client' ? { client: userId } : { provider: userId };
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(50);
};

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;
