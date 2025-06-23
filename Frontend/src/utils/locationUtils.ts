// Base URL constant for API calls
const API_BASE_URL = 'http://127.0.0.1:5000';

export interface Location {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
}

interface LocationDetails {
  city: string;
  state: string;
  country: string;
}

// Singleton to cache the last known location in memory
let cachedLocation: Location | null = null;

export const requestLocationPermission = async (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    // Return cached location if available
    if (cachedLocation) {
      console.log('[requestLocationPermission] Using cached location:', cachedLocation);
      resolve(cachedLocation);
      return;
    }

    if (!navigator.geolocation) {
      const errorMessage = 'Geolocation is not supported by your browser';
      console.error('[requestLocationPermission] Error:', errorMessage);
      reject({ error: errorMessage, isGeolocationUnsupported: true });
      return;
    }

    console.log('[requestLocationPermission] Requesting location permission...');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log('[requestLocationPermission] Successfully got coordinates:', { latitude, longitude });
        
        try {
          const locationDetails = await getLocationDetails(latitude, longitude);
          console.log('[requestLocationPermission] Got location details:', locationDetails);
          
          const location = {
            latitude,
            longitude,
            ...locationDetails
          };
          
          saveUserLocation(location);
          cachedLocation = location; // Cache in memory
          console.log('[requestLocationPermission] Resolving with location:', location);
          resolve(location);
        } catch (error) {
          console.warn('[requestLocationPermission] Failed to get location details:', error);
          const storedLocation = getUserLocation();
          if (storedLocation) {
            console.log('[requestLocationPermission] Using stored location as fallback:', storedLocation);
            cachedLocation = storedLocation;
            resolve(storedLocation);
          } else {
            const fallbackLocation = {
              latitude,
              longitude,
              city: 'Kochi',
              state: 'Kerala',
              country: 'India'
            };
            saveUserLocation(fallbackLocation);
            cachedLocation = fallbackLocation;
            console.log('[requestLocationPermission] Using Kochi as fallback:', fallbackLocation);
            resolve(fallbackLocation);
          }
        }
      },
      (error) => {
        console.error('[requestLocationPermission] Geolocation error:', error);
        let errorMessage = 'Unknown location error';
        
        if (error.code === 1) {
          errorMessage = 'Location permission denied. Please enable location services in your browser settings.';
        } else if (error.code === 2) {
          errorMessage = 'Location unavailable. Try again later.';
        } else if (error.code === 3) {
          errorMessage = 'Location request timed out. Try again later.';
        }
        
        console.error('[requestLocationPermission] Error message:', errorMessage);
        const storedLocation = getUserLocation();
        if (storedLocation) {
          console.log('[requestLocationPermission] Using stored location due to geolocation error:', storedLocation);
          cachedLocation = storedLocation;
          resolve(storedLocation);
        } else {
          console.log('[requestLocationPermission] Rejecting with error:', errorMessage);
          reject({ error: errorMessage, code: error.code });
        }
      },
      { 
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  });
};

// Helper function to get location details from coordinates
export const getLocationDetails = async (latitude: number, longitude: number): Promise<LocationDetails> => {
  try {
    const response = await fetch(`${API_BASE_URL}/geocode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latitude, longitude }),
    });

    if (!response.ok) {
      throw new Error('Failed to get location details');
    }

    const data = await response.json();
    return {
      city: data.city,
      state: data.state,
      country: data.country,
    };
  } catch (error) {
    console.error('[getLocationDetails] Error:', error);
    throw error;
  }
};

export const saveUserLocation = (location: Location): void => {
  try {
    localStorage.setItem('pocketfarm_location', JSON.stringify(location));
    cachedLocation = location; // Update cache
    console.log('[saveUserLocation] Saved location:', location);
  } catch (error) {
    console.error('[saveUserLocation] Error saving location:', error);
  }
};

export const getUserLocation = (): Location | null => {
  const storedLocation = localStorage.getItem('pocketfarm_location');
  if (storedLocation) {
    try {
      const location = JSON.parse(storedLocation);
      console.log('[getUserLocation] Retrieved stored location:', location);
      return location;
    } catch (error) {
      console.error('[getUserLocation] Error parsing stored location:', error);
      return null;
    }
  }
  return null;
};

// Calculate distance between two points in km
export const getDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI/180);
};

// Helper function to clear stored location - useful for debugging
export const clearStoredLocation = (): void => {
  localStorage.removeItem('pocketfarm_location');
  cachedLocation = null; // Clear in-memory cache too
  console.log('[clearStoredLocation] Cleared stored location');
};

// Initialize cache from localStorage on load
const initializeLocationCache = () => {
  const storedLocation = getUserLocation();
  if (storedLocation) {
    cachedLocation = storedLocation;
    console.log('[initializeLocationCache] Initialized cache with stored location:', cachedLocation);
  }
};

// Initialize cache when the module loads
initializeLocationCache();