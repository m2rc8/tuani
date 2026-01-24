const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Información básica
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },

  name: {
    type: String,
    trim: true
  },

  email: {
    type: String,
    trim: true,
    lowercase: true
  },

  // Rol del usuario
  role: {
    type: String,
    enum: ['pending', 'client', 'provider', 'admin'],
    default: 'pending'
  },

  // Estado del usuario
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'in_review'],
    default: 'active'
  },

  // Ubicación base (para prestadores principalmente)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    address: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },

  // Información específica para PRESTADORES
  providerInfo: {
    // Categorías de servicio que ofrece
    categories: [{
      type: String,
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
    }],

    // Tarifa por hora
    hourlyRate: {
      type: Number,
      min: 0
    },

    // Disponibilidad
    availability: {
      type: String,
      enum: ['available', 'busy', 'offline'],
      default: 'available'
    },

    // Acepta trabajos de emergencia
    acceptsEmergencies: {
      type: Boolean,
      default: false
    },

    // Radio de servicio en km
    serviceRadius: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    },

    // Calificación promedio
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },

    // Número de reseñas
    reviewsCount: {
      type: Number,
      default: 0
    },

    // Trabajos completados
    completedJobs: {
      type: Number,
      default: 0
    },

    // Documentos de verificación
    verification: {
      idDocument: {
        url: String,
        verified: { type: Boolean, default: false },
        verifiedAt: Date
      },
      certifications: [{
        name: String,
        url: String,
        verified: { type: Boolean, default: false }
      }],
      backgroundCheck: {
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending'
        },
        completedAt: Date
      }
    },

    // Información bancaria (encriptada)
    bankInfo: {
      accountHolder: String,
      bankName: String,
      accountNumber: String, // Encriptado
      accountType: String,
      isVerified: { type: Boolean, default: false }
    },

    // Fotos del trabajo
    portfolioImages: [{
      url: String,
      description: String,
      uploadedAt: { type: Date, default: Date.now }
    }],

    // Descripción del perfil
    bio: String,

    // Años de experiencia
    yearsOfExperience: Number
  },

  // Información específica para CLIENTES
  clientInfo: {
    // Dirección preferida
    preferredAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      coordinates: [Number] // [longitude, latitude]
    },

    // Historial de servicios solicitados
    servicesRequested: {
      type: Number,
      default: 0
    },

    // Calificación promedio dada a prestadores
    averageRatingGiven: {
      type: Number,
      default: 0
    }
  },

  // Métodos de pago guardados
  paymentMethods: [{
    stripePaymentMethodId: String,
    last4: String,
    brand: String,
    isDefault: Boolean
  }],

  // Configuraciones de notificaciones
  notifications: {
    whatsapp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },

  // Preferencias
  preferences: {
    language: { type: String, default: 'es' },
    currency: { type: String, default: 'MXN' }
  },

  // Metadata
  lastActive: {
    type: Date,
    default: Date.now
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices geoespaciales para búsqueda de prestadores cercanos
userSchema.index({ 'location': '2dsphere' });
userSchema.index({ 'role': 1, 'status': 1 });
userSchema.index({ 'providerInfo.categories': 1 });
userSchema.index({ 'providerInfo.availability': 1 });

// Métodos del esquema
userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

userSchema.methods.isProvider = function() {
  return this.role === 'provider';
};

userSchema.methods.isClient = function() {
  return this.role === 'client';
};

userSchema.methods.canAcceptJobs = function() {
  return (
    this.role === 'provider' &&
    this.status === 'active' &&
    this.providerInfo.availability === 'available' &&
    this.providerInfo.verification.backgroundCheck.status === 'approved'
  );
};

// Método estático para buscar prestadores cercanos
userSchema.statics.findNearbyProviders = async function(latitude, longitude, category, radiusKm = 10) {
  return this.find({
    role: 'provider',
    status: 'active',
    'providerInfo.availability': 'available',
    'providerInfo.categories': category,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: radiusKm * 1000 // convertir km a metros
      }
    }
  })
  .select('name phoneNumber providerInfo location')
  .sort({ 'providerInfo.rating': -1 })
  .limit(10);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
