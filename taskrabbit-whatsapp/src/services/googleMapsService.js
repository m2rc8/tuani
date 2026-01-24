const axios = require('axios');
const logger = require('../utils/logger');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_BASE_URL = 'https://maps.googleapis.com/maps/api';

/**
 * Calcula la distancia entre dos puntos usando Google Maps Distance Matrix API
 */
exports.calculateDistance = async (origin, destination) => {
  try {
    const url = `${GOOGLE_MAPS_BASE_URL}/distancematrix/json`;

    const params = {
      origins: `${origin.latitude},${origin.longitude}`,
      destinations: `${destination.latitude},${destination.longitude}`,
      key: GOOGLE_MAPS_API_KEY,
      units: 'metric', // kilómetros
      mode: 'driving' // driving, walking, bicycling, transit
    };

    const response = await axios.get(url, { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    const element = response.data.rows[0].elements[0];

    if (element.status !== 'OK') {
      throw new Error(`No se pudo calcular la distancia: ${element.status}`);
    }

    return {
      distance: {
        meters: element.distance.value,
        kilometers: (element.distance.value / 1000).toFixed(2),
        text: element.distance.text
      },
      duration: {
        seconds: element.duration.value,
        minutes: Math.ceil(element.duration.value / 60),
        text: element.duration.text
      }
    };

  } catch (error) {
    logger.error('Error al calcular distancia:', error);
    throw error;
  }
};

/**
 * Calcula distancias entre un punto de origen y múltiples destinos
 */
exports.calculateDistanceMatrix = async (origin, destinations) => {
  try {
    const url = `${GOOGLE_MAPS_BASE_URL}/distancematrix/json`;

    // Convertir destinos a formato de coordenadas
    const destinationsString = destinations
      .map(dest => `${dest.latitude},${dest.longitude}`)
      .join('|');

    const params = {
      origins: `${origin.latitude},${origin.longitude}`,
      destinations: destinationsString,
      key: GOOGLE_MAPS_API_KEY,
      units: 'metric',
      mode: 'driving'
    };

    const response = await axios.get(url, { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }

    const results = response.data.rows[0].elements.map((element, index) => {
      if (element.status !== 'OK') {
        return {
          index,
          error: element.status,
          distance: null,
          duration: null
        };
      }

      return {
        index,
        destination: destinations[index],
        distance: {
          meters: element.distance.value,
          kilometers: parseFloat((element.distance.value / 1000).toFixed(2)),
          text: element.distance.text
        },
        duration: {
          seconds: element.duration.value,
          minutes: Math.ceil(element.duration.value / 60),
          text: element.duration.text
        }
      };
    });

    return results;

  } catch (error) {
    logger.error('Error al calcular matriz de distancias:', error);
    throw error;
  }
};

/**
 * Obtiene la dirección formateada desde coordenadas (Reverse Geocoding)
 */
exports.reverseGeocode = async (latitude, longitude) => {
  try {
    const url = `${GOOGLE_MAPS_BASE_URL}/geocode/json`;

    const params = {
      latlng: `${latitude},${longitude}`,
      key: GOOGLE_MAPS_API_KEY,
      language: 'es'
    };

    const response = await axios.get(url, { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding error: ${response.data.status}`);
    }

    const result = response.data.results[0];

    // Extraer componentes de dirección
    const addressComponents = {};
    result.address_components.forEach(component => {
      component.types.forEach(type => {
        addressComponents[type] = component.long_name;
      });
    });

    return {
      formattedAddress: result.formatted_address,
      street: addressComponents.route || '',
      streetNumber: addressComponents.street_number || '',
      neighborhood: addressComponents.neighborhood || addressComponents.sublocality || '',
      city: addressComponents.locality || addressComponents.administrative_area_level_2 || '',
      state: addressComponents.administrative_area_level_1 || '',
      country: addressComponents.country || '',
      postalCode: addressComponents.postal_code || '',
      placeId: result.place_id
    };

  } catch (error) {
    logger.error('Error en reverse geocoding:', error);
    throw error;
  }
};

/**
 * Obtiene coordenadas desde una dirección (Geocoding)
 */
exports.geocode = async (address) => {
  try {
    const url = `${GOOGLE_MAPS_BASE_URL}/geocode/json`;

    const params = {
      address,
      key: GOOGLE_MAPS_API_KEY,
      language: 'es'
    };

    const response = await axios.get(url, { params });

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding error: ${response.data.status}`);
    }

    const result = response.data.results[0];

    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      bounds: result.geometry.bounds,
      locationType: result.geometry.location_type
    };

  } catch (error) {
    logger.error('Error en geocoding:', error);
    throw error;
  }
};

/**
 * Genera un enlace de Google Maps
 */
exports.generateMapLink = (latitude, longitude, label = '') => {
  const encodedLabel = encodeURIComponent(label);
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodedLabel}`;
};

/**
 * Genera un enlace de direcciones (de punto A a punto B)
 */
exports.generateDirectionsLink = (origin, destination) => {
  const originStr = `${origin.latitude},${origin.longitude}`;
  const destStr = `${destination.latitude},${destination.longitude}`;

  return `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving`;
};

/**
 * Calcula si un punto está dentro de un radio determinado
 */
exports.isWithinRadius = (point1, point2, radiusKm) => {
  const distance = exports.haversineDistance(
    point1.latitude,
    point1.longitude,
    point2.latitude,
    point2.longitude
  );

  return distance <= radiusKm;
};

/**
 * Calcula la distancia entre dos puntos usando la fórmula de Haversine
 * (útil para cálculos rápidos sin llamar a la API)
 */
exports.haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radio de la Tierra en km

  const dLat = exports.toRadians(lat2 - lat1);
  const dLon = exports.toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(exports.toRadians(lat1)) *
      Math.cos(exports.toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distancia en km
};

/**
 * Convierte grados a radianes
 */
exports.toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Obtiene el tiempo estimado de llegada
 */
exports.getETA = async (origin, destination) => {
  try {
    const distanceData = await exports.calculateDistance(origin, destination);
    const now = new Date();
    const etaDate = new Date(now.getTime() + distanceData.duration.seconds * 1000);

    return {
      eta: etaDate,
      etaFormatted: etaDate.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      duration: distanceData.duration,
      distance: distanceData.distance
    };

  } catch (error) {
    logger.error('Error al calcular ETA:', error);
    throw error;
  }
};

/**
 * Busca lugares cercanos (ej: gasolineras, estacionamientos)
 */
exports.findNearbyPlaces = async (latitude, longitude, type, radiusMeters = 1000) => {
  try {
    const url = `${GOOGLE_MAPS_BASE_URL}/place/nearbysearch/json`;

    const params = {
      location: `${latitude},${longitude}`,
      radius: radiusMeters,
      type,
      key: GOOGLE_MAPS_API_KEY,
      language: 'es'
    };

    const response = await axios.get(url, { params });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Places API error: ${response.data.status}`);
    }

    return response.data.results.map(place => ({
      name: place.name,
      address: place.vicinity,
      location: {
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng
      },
      rating: place.rating,
      placeId: place.place_id,
      isOpen: place.opening_hours?.open_now
    }));

  } catch (error) {
    logger.error('Error al buscar lugares cercanos:', error);
    throw error;
  }
};

module.exports = exports;
