import { Nursery } from '../types/cropTypes';
import { mockNurseries } from '../data/mockData';
import { getDistance } from '../locationUtils';

// Base URL constant for API calls
const API_BASE_URL = 'http://127.0.0.1:5000';

// Fetch nearby nurseries using Overpass API
export const fetchNearbyNurseries = async (latitude: number, longitude: number): Promise<Nursery[]> => {
  console.log('Fetching nurseries near:', { latitude, longitude });
  
  try {
    // First try our backend API
    console.log('Using API URL for nurseries:', API_BASE_URL);
    
    try {
      // Make a POST request to the nurseries endpoint
      const response = await fetch(`${API_BASE_URL}/nurseries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude,
          longitude,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned status ${response.status}: ${await response.text()}`);
      }

      // Parse the JSON response
      const data = await response.json();
      console.log('Received nurseries data from backend:', data);
      
      // Start periodic address updates
      const nurseries = data.nurseries || [];
      if (nurseries.length > 0) {
        // Check for updates every 2 seconds for up to 30 seconds
        let attempts = 0;
        const checkUpdates = async () => {
          if (attempts >= 15) return; // Stop after 15 attempts (30 seconds)
          
          const updatedNurseries = await checkAddressUpdates(nurseries);
          if (updatedNurseries.some(n => n.address_loading)) {
            attempts++;
            setTimeout(checkUpdates, 2000);
          }
        };
        
        checkUpdates();
      }
      
      return nurseries;
    } catch (backendError) {
      console.warn('Backend nursery API failed, trying Overpass API:', backendError);
      
      // If backend fails, try Overpass API directly
      return await fetchFromOverpassAPI(latitude, longitude);
    }
  } catch (error) {
    console.error('All nursery API calls failed:', error);
    
    // Final fallback to mock data
    console.log('Using mock nursery data as last resort');
    return [...mockNurseries].map(nursery => {
      const distance = getDistance(latitude, longitude, nursery.latitude, nursery.longitude);
      return { ...nursery, distance: parseFloat(distance.toFixed(1)) };
    }).sort((a, b) => a.distance - b.distance);
  }
};

// Function to fetch from Overpass API
const fetchFromOverpassAPI = async (latitude: number, longitude: number): Promise<Nursery[]> => {
  try {
    console.log('Fetching from Overpass API');
    
    // Search radius in meters
    const radius = 50000; // 50km radius
    
    // Construct the Overpass API query
    // We search only for garden centers, plant nurseries, and fertilizer shops
    const overpassQuery = `
      [out:json];
      (
        // Garden centers and nurseries
        node["shop"="garden_centre"](around:${radius},${latitude},${longitude});
        node["shop"="plant_nursery"](around:${radius},${latitude},${longitude});
        node["shop"="agricultural_supplies"](around:${radius},${latitude},${longitude});
        node["shop"="agrarian"](around:${radius},${latitude},${longitude});
        node["shop"="farm"](around:${radius},${latitude},${longitude});
        node["shop"="seeds"](around:${radius},${latitude},${longitude});
        node["shop"="fertilizer"](around:${radius},${latitude},${longitude});
        
        // Plant-related amenities
        node["amenity"="marketplace"]["plant"](around:${radius},${latitude},${longitude});
        node["amenity"="garden_centre"](around:${radius},${latitude},${longitude});
        node["amenity"="plant_school"](around:${radius},${latitude},${longitude});
        node["amenity"="greenhouse"](around:${radius},${latitude},${longitude});
        
        // Additional plant-related businesses
        node["shop"="florist"]["plant"](around:${radius},${latitude},${longitude});
        node["shop"="garden_furniture"](around:${radius},${latitude},${longitude});
        node["shop"="landscape"](around:${radius},${latitude},${longitude});
      );
      out body;
      >;
      out skel qt;
    `;
    
    // URL encode the query
    const encodedQuery = encodeURIComponent(overpassQuery.trim());
    
    // Overpass API endpoint
    const overpassEndpoint = 'https://overpass-api.de/api/interpreter';
    
    // Make the request
    const response = await fetch(`${overpassEndpoint}?data=${encodedQuery}`);
    
    if (!response.ok) {
      throw new Error(`Overpass API returned status ${response.status}`);
    }
    
    // Parse the JSON response
    const data = await response.json();
    console.log('Overpass API response:', data);
    
    if (!data.elements || data.elements.length === 0) {
      console.log('No nurseries found in Overpass API response');
      return [];
    }
    
    // Transform Overpass results to our Nursery format
    const nurseries: Nursery[] = data.elements.map((place: any, index: number) => {
      // Calculate distance using our utility
      const distance = getDistance(latitude, longitude, place.lat, place.lon);
      
      // Determine if it's a nursery or agricultural store based on tags and name
      const tags = place.tags || {};
      const name = tags.name || tags['name:en'] || 'Garden Center';
      const lowerName = name.toLowerCase();
      
      // Check if it's a nursery based on name keywords or tags
      const isNursery = tags.shop === 'plant_nursery' || 
                      (tags.amenity === 'marketplace' && tags.plant) ||
                      lowerName.includes('nursery') ||
                      lowerName.includes('garden') ||
                      lowerName.includes('plant') ||
                      lowerName.includes('farm');
      
      // Skip florist shops
      if (tags.shop === 'florist') {
        return null;
      }
      
      // Get the address components
      const street = tags['addr:street'] || '';
      const housenumber = tags['addr:housenumber'] || '';
      const city = tags['addr:city'] || '';
      const state = tags['addr:state'] || '';
      const postcode = tags['addr:postcode'] || '';
      
      // Build a more detailed address
      const addressParts = [
        housenumber && street ? `${housenumber} ${street}` : street,
        city,
        state,
        postcode
      ].filter(Boolean);
      
      const address = addressParts.join(', ') || 'Address unavailable';
      
      // Get the website - remove http/https if present for consistent formatting
      let website = tags.website || '';
      if (website && (website.startsWith('http://') || website.startsWith('https://'))) {
        website = website.replace(/^https?:\/\//, '');
      }
      
      // Get phone number - try multiple possible tags
      const phone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || '';
      
      // Get rating - try multiple possible tags and normalize to 0-5 scale
      let rating = 0;
      if (tags.rating) {
        rating = parseFloat(tags.rating);
      } else if (tags.stars) {
        rating = parseFloat(tags.stars);
      } else if (tags.review_score) {
        rating = parseFloat(tags.review_score);
      }
      
      // Normalize rating to 0-5 scale if it's in a different range
      if (rating > 5) {
        rating = 5;
      } else if (rating < 0) {
        rating = 0;
      }
      
      // Determine business type from tags
      let businessType = 'Garden Center';
      if (tags.shop === 'plant_nursery') {
        businessType = 'Plant Nursery';
      } else if (tags.shop === 'garden_centre') {
        businessType = 'Garden Center';
      } else if (tags.shop === 'agricultural_supplies') {
        businessType = 'Agricultural Supplies';
      } else if (tags.shop === 'agrarian') {
        businessType = 'Agrarian Store';
      } else if (tags.shop === 'farm') {
        businessType = 'Farm Shop';
      } else if (tags.shop === 'seeds') {
        businessType = 'Seed Store';
      } else if (tags.shop === 'fertilizer') {
        businessType = 'Fertilizer Shop';
      } else if (tags.amenity === 'marketplace' && tags.plant) {
        businessType = 'Plant Market';
      } else if (tags.amenity === 'garden_centre') {
        businessType = 'Garden Center';
      } else if (tags.amenity === 'plant_school') {
        businessType = 'Plant School';
      } else if (tags.amenity === 'greenhouse') {
        businessType = 'Greenhouse';
      } else if (tags.shop === 'garden_furniture') {
        businessType = 'Garden Furniture';
      } else if (tags.shop === 'landscape') {
        businessType = 'Landscape Services';
      }
      
      // Use the literal type instead of a generic string
      const nurseryType: 'nursery' | 'store' = isNursery ? 'nursery' : 'store';
      
      return {
        id: `overpass-${place.id || index}`,
        name: name,
        type: nurseryType,
        businessType: businessType,
        address: address,
        distance: parseFloat(distance.toFixed(1)),
        rating: rating,
        phone: phone,
        website: website,
        latitude: place.lat || place.latitude,
        longitude: place.lon || place.longitude,
        lat: place.lat,
        lon: place.lon,
        address_loading: true // Set initial loading state
      };
    }).filter(Boolean); // Remove null entries (florists)
    
    // Sort by distance
    return nurseries.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error('Error fetching from Overpass API:', error);
    return [];
  }
};

// Function to periodically check for address updates
const checkAddressUpdates = async (nurseries: Nursery[]): Promise<Nursery[]> => {
  try {
    // Get the first nursery's coordinates for the request
    const firstNursery = nurseries[0];
    if (!firstNursery) return nurseries;

    const response = await fetch(`${API_BASE_URL}/nurseries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        latitude: firstNursery.latitude || firstNursery.lat,
        longitude: firstNursery.longitude || firstNursery.lon,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}`);
    }

    const data = await response.json();
    const updatedNurseries = data.nurseries || [];

    // Update addresses for nurseries that have finished loading
    return nurseries.map(nursery => {
      const updatedNursery = updatedNurseries.find(n => n.id === nursery.id);
      if (updatedNursery && !updatedNursery.address_loading) {
        return {
          ...nursery,
          address: updatedNursery.address,
          address_loading: false
        };
      }
      return nursery;
    });
  } catch (error) {
    console.error('Error checking address updates:', error);
    return nurseries;
  }
};
