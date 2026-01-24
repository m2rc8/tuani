const twilioService = require('./twilioService');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Inicia el proceso de registro de un prestador
 */
exports.startRegistration = async (user, conversation) => {
  try {
    await twilioService.sendMessage(
      user.phoneNumber,
      `✅ Gracias ${user.name}!\n\n` +
      `Vamos a completar tu registro como prestador de servicios.\n\n` +
      `*Paso 1 de 5*: ¿Qué servicio ofreces?\n\n` +
      `Por favor escribe el número de tu categoría:\n\n` +
      `1. Plomería\n` +
      `2. Electricidad\n` +
      `3. Limpieza del hogar\n` +
      `4. Carpintería\n` +
      `5. Pintura\n` +
      `6. Jardinería\n` +
      `7. Reparación de electrodomésticos\n` +
      `8. Otro (especificar)`
    );

    conversation.setState('provider_registration');
    conversation.data.registrationStep = 'category';

  } catch (error) {
    logger.error('Error al iniciar registro de prestador:', error);
    throw error;
  }
};

/**
 * Procesa los pasos del registro
 */
exports.processRegistrationStep = async (user, conversation, input) => {
  const step = conversation.data.registrationStep;

  try {
    switch (step) {
      case 'category':
        await handleCategoryStep(user, conversation, input);
        break;

      case 'location':
        await handleLocationStep(user, conversation, input);
        break;

      case 'hourly_rate':
        await handleHourlyRateStep(user, conversation, input);
        break;

      case 'experience':
        await handleExperienceStep(user, conversation, input);
        break;

      case 'bio':
        await handleBioStep(user, conversation, input);
        break;

      default:
        logger.warn(`Paso de registro desconocido: ${step}`);
    }

  } catch (error) {
    logger.error('Error al procesar paso de registro:', error);
    await twilioService.sendMessage(
      user.phoneNumber,
      '❌ Ocurrió un error. Por favor intenta nuevamente.'
    );
  }
};

async function handleCategoryStep(user, conversation, input) {
  const categories = {
    '1': 'Plomería',
    '2': 'Electricidad',
    '3': 'Limpieza del hogar',
    '4': 'Carpintería',
    '5': 'Pintura',
    '6': 'Jardinería',
    '7': 'Reparación de electrodomésticos',
    '8': 'Otro'
  };

  const category = categories[input.trim()];

  if (!category) {
    await twilioService.sendMessage(
      user.phoneNumber,
      '❌ Por favor selecciona un número del 1 al 8.'
    );
    return;
  }

  if (category === 'Otro') {
    await twilioService.sendMessage(
      user.phoneNumber,
      'Por favor especifica qué servicio ofreces:'
    );
    conversation.data.registrationStep = 'category_other';
    return;
  }

  user.providerInfo = user.providerInfo || {};
  user.providerInfo.categories = [category];
  await user.save();

  await twilioService.sendLocationRequest(
    user.phoneNumber,
    `*Paso 2 de 5*: Ubicación base\n\n` +
    `Comparte tu ubicación base de operación (desde donde prestas servicios).`
  );

  conversation.data.registrationStep = 'location';
}

async function handleLocationStep(user, conversation, input) {
  if (typeof input === 'object' && input.latitude && input.longitude) {
    user.location = {
      type: 'Point',
      coordinates: [input.longitude, input.latitude]
    };

    await user.save();

    await twilioService.sendMessage(
      user.phoneNumber,
      `*Paso 3 de 5*: Tarifa por hora\n\n` +
      `¿Cuál es tu tarifa por hora? (solo escribe el número)\n` +
      `Ejemplo: 50`
    );

    conversation.data.registrationStep = 'hourly_rate';

  } else {
    await twilioService.sendMessage(
      user.phoneNumber,
      '❌ Por favor comparte tu ubicación usando el botón de ubicación de WhatsApp.'
    );
  }
}

async function handleHourlyRateStep(user, conversation, input) {
  const rate = parseFloat(input);

  if (isNaN(rate) || rate <= 0) {
    await twilioService.sendMessage(
      user.phoneNumber,
      '❌ Por favor ingresa un número válido mayor a 0.'
    );
    return;
  }

  user.providerInfo.hourlyRate = rate;
  await user.save();

  await twilioService.sendMessage(
    user.phoneNumber,
    `*Paso 4 de 5*: Experiencia\n\n` +
    `¿Cuántos años de experiencia tienes? (solo escribe el número)\n` +
    `Ejemplo: 5`
  );

  conversation.data.registrationStep = 'experience';
}

async function handleExperienceStep(user, conversation, input) {
  const years = parseInt(input);

  if (isNaN(years) || years < 0) {
    await twilioService.sendMessage(
      user.phoneNumber,
      '❌ Por favor ingresa un número válido.'
    );
    return;
  }

  user.providerInfo.yearsOfExperience = years;
  await user.save();

  await twilioService.sendMessage(
    user.phoneNumber,
    `*Paso 5 de 5*: Descripción\n\n` +
    `Cuéntanos un poco sobre ti y tus servicios (máximo 200 caracteres):`
  );

  conversation.data.registrationStep = 'bio';
}

async function handleBioStep(user, conversation, input) {
  user.providerInfo.bio = input.substring(0, 200);
  user.status = 'in_review';
  await user.save();

  await twilioService.sendMessage(
    user.phoneNumber,
    `✅ *¡Registro completado!*\n\n` +
    `Tu perfil está en revisión. Te notificaremos en 24-48 horas una vez aprobado.\n\n` +
    `Mientras tanto, puedes enviar fotos de trabajos anteriores para mejorar tu perfil.`
  );

  conversation.setState('idle');
  conversation.data = {};
}

module.exports = exports;
