const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const mongoURI = process.env.NODE_ENV === 'production'
      ? process.env.MONGODB_URI_PROD
      : process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MongoDB URI no está configurada en las variables de entorno');
    }

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(mongoURI, options);

    logger.info('✅ MongoDB conectado exitosamente');

    // Eventos de conexión
    mongoose.connection.on('error', (err) => {
      logger.error('❌ Error de conexión MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB desconectado');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconectado');
    });

  } catch (error) {
    logger.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
