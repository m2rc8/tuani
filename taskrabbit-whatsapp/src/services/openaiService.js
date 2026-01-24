const { OpenAI } = require('openai');
const { SYSTEM_PROMPT } = require('../config/openai-system-prompt');
const logger = require('../utils/logger');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analiza una solicitud de servicio usando OpenAI
 */
exports.analyzeServiceRequest = async (userMessage, context = []) => {
  try {
    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      }
    ];

    // Agregar contexto de conversación previa si existe
    if (context && context.length > 0) {
      context.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Agregar el mensaje actual del usuario
    messages.push({
      role: 'user',
      content: `Analiza esta solicitud de servicio: "${userMessage}"`
    });

    logger.info('🤖 Enviando solicitud a OpenAI...');

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.3, // Baja temperatura para mayor consistencia
      max_tokens: 500
    });

    const response = completion.choices[0].message.content;
    const analysis = JSON.parse(response);

    logger.info('🤖 Análisis de OpenAI:', analysis);

    return analysis;

  } catch (error) {
    logger.error('Error en analyzeServiceRequest:', error);

    // Retornar un análisis vacío en caso de error
    return {
      category: null,
      confidence: 0,
      urgency: 'normal',
      details: '',
      keywords: []
    };
  }
};

/**
 * Genera una respuesta conversacional usando OpenAI
 */
exports.generateResponse = async (userMessage, conversationHistory = []) => {
  try {
    const messages = [
      {
        role: 'system',
        content: `Eres un asistente amable que ayuda a coordinar servicios del hogar.
        Responde de manera breve, amigable y profesional. Usa emojis moderadamente.
        Siempre mantén un tono servicial y eficiente.`
      }
    ];

    // Agregar historial de conversación
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Agregar mensaje actual
    messages.push({
      role: 'user',
      content: userMessage
    });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages,
      temperature: 0.7,
      max_tokens: 300
    });

    return completion.choices[0].message.content;

  } catch (error) {
    logger.error('Error en generateResponse:', error);
    return 'Disculpa, tuve un problema al procesar tu mensaje. ¿Podrías repetirlo?';
  }
};

/**
 * Extrae información estructurada de un mensaje de texto libre
 */
exports.extractInformation = async (userMessage, extractionType) => {
  try {
    const prompts = {
      address: `Extrae la dirección completa del siguiente texto. Responde solo con la dirección o null si no hay una dirección clara: "${userMessage}"`,

      time: `Extrae la hora o periodo de tiempo mencionado en el siguiente texto. Responde en formato JSON con {hora: "HH:MM", periodo: "mañana/tarde/noche"} o null: "${userMessage}"`,

      date: `Extrae la fecha mencionada en el siguiente texto. Responde en formato JSON con {fecha: "YYYY-MM-DD", relativa: "hoy/mañana/esta semana"} o null: "${userMessage}"`,

      quantity: `Extrae cantidades numéricas del siguiente texto. Responde en formato JSON con {cantidad: number, unidad: "string"} o null: "${userMessage}"`
    };

    const prompt = prompts[extractionType];
    if (!prompt) {
      throw new Error(`Tipo de extracción no válido: ${extractionType}`);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en extraer información estructurada de texto. Responde solo con la información solicitada, sin explicaciones adicionales.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 100
    });

    const response = completion.choices[0].message.content.trim();

    // Intentar parsear como JSON si es posible
    try {
      return JSON.parse(response);
    } catch {
      return response === 'null' ? null : response;
    }

  } catch (error) {
    logger.error('Error en extractInformation:', error);
    return null;
  }
};

/**
 * Analiza el sentimiento de un mensaje (útil para detectar quejas/problemas)
 */
exports.analyzeSentiment = async (message) => {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Analiza el sentimiento del siguiente mensaje. Responde solo con un JSON: {sentimiento: "positivo/neutral/negativo", urgencia: "baja/media/alta", requiere_atencion_humana: boolean}'
        },
        {
          role: 'user',
          content: message
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 100
    });

    return JSON.parse(completion.choices[0].message.content);

  } catch (error) {
    logger.error('Error en analyzeSentiment:', error);
    return {
      sentimiento: 'neutral',
      urgencia: 'baja',
      requiere_atencion_humana: false
    };
  }
};

/**
 * Genera un resumen de una conversación larga
 */
exports.summarizeConversation = async (messages) => {
  try {
    const conversationText = messages.map(msg =>
      `${msg.role === 'user' ? 'Cliente' : 'Asistente'}: ${msg.content}`
    ).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Resume la siguiente conversación en 2-3 oraciones, destacando lo más importante.'
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
      temperature: 0.5,
      max_tokens: 200
    });

    return completion.choices[0].message.content;

  } catch (error) {
    logger.error('Error en summarizeConversation:', error);
    return 'No se pudo generar un resumen de la conversación.';
  }
};

/**
 * Traduce texto a otro idioma (útil para expansión internacional)
 */
exports.translate = async (text, targetLanguage = 'en') => {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `Traduce el siguiente texto a ${targetLanguage}. Responde solo con la traducción, sin explicaciones.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    return completion.choices[0].message.content;

  } catch (error) {
    logger.error('Error en translate:', error);
    return text; // Retornar texto original si falla
  }
};

module.exports = exports;
