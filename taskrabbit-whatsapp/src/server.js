require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const connectDB = require('./config/database');
const whatsappRoutes = require('./routes/whatsapp');
const stripeWebhookRoutes = require('./routes/stripe-webhook');

const app = express();
const PORT = process.env.PORT || 3000;

// Conectar a la base de datos
connectDB();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting para prevenir abuso
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por ventana
  message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde.'
});

app.use('/webhook', limiter);

// Body parser middleware
// IMPORTANTE: Para Stripe webhook, necesitamos raw body
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Routes
app.use('/webhook/whatsapp', whatsappRoutes);
app.use('/webhook/stripe', stripeWebhookRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
  logger.info(`🚀 Servidor corriendo en puerto ${PORT}`);
  logger.info(`📱 Webhook WhatsApp: http://localhost:${PORT}/webhook/whatsapp`);
  logger.info(`💳 Webhook Stripe: http://localhost:${PORT}/webhook/stripe`);
});

// Manejo de señales de terminación
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT recibido. Cerrando servidor...');
  process.exit(0);
});

module.exports = app;
