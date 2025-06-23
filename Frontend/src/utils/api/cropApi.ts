import { Crop, GrowingConditions } from '../types/cropTypes';
import { mockCrops } from '../data/mockData';

// Base URL constant for API calls
const API_BASE_URL = 'http://127.0.0.1:5000';

export const fetchRecommendedCrops = async (conditions: GrowingConditions): Promise<Crop[]> => {
  console.log('Fetching recommendations with:', conditions);
  
  try {
    console.log('Using API URL for recommendations:', API_BASE_URL);
    
    // Make a POST request to the recommend endpoint
    const response = await fetch(`${API_BASE_URL}/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: conditions.location.city || 'Unknown',
        sunlight: conditions.sunlight,
        water_needs: conditions.waterNeeds,
        avg_area: conditions.area,
        include_companions: conditions.wantCompanion,
      }),
    });

    console.log('Response status:', response.status); // Log the response status

    if (!response.ok) {
      const errorText = await response.text(); // Log the error response
      console.error('Backend returned an error:', errorText);
      throw new Error(`Backend returned status ${response.status}: ${errorText}`);
    }

    // Parse the JSON response
    const data = await response.json();
    console.log('Received recommendations:', data);
    
    // Map the backend response to the Crop type expected by the frontend
    const recommendedCrops: Crop[] = data.map((crop: any) => ({
      id: crop.id,
      name: crop.name,
      imageURL: crop.imageURL,
      scientific_name: crop.scientific_name,
      description: crop.description,
      origin: crop.origin,
      growing_conditions: crop.growing_conditions,
      planting_info: crop.planting_info,
      care_instructions: crop.care_instructions,
      storage_info: crop.storage_info,
      nutritional_info: crop.nutritional_info,
      culinary_info: crop.culinary_info,
      sunlight: crop.recommended_info.sunlight,
      waterNeeds: crop.recommended_info.water_needs,
      companionCrops: crop.companion_crops || [],
    }));

    return recommendedCrops;
  } catch (error) {
    console.error('Error fetching crop recommendations:', error);
    
    // Fallback to mock data if the API call fails (for development)
    return mockCrops.filter(crop => {
      if (conditions.sunlight && crop.sunlight !== conditions.sunlight) {
        return false;
      }
      
      if (conditions.waterNeeds && crop.waterNeeds !== conditions.waterNeeds) {
        return false;
      }
      
      return true;
    });
  }
};

export const fetchCropByName = async (cropName: string): Promise<Crop | null> => {
  console.log('Fetching crop details for:', cropName);
  
  try {
    console.log('Using API URL for crop lookup:', API_BASE_URL);
    
    // Make a GET request to the crop endpoint
    const response = await fetch(`${API_BASE_URL}/crop/${encodeURIComponent(cropName)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}: ${await response.text()}`);
    }

    // Parse the JSON response
    const data = await response.json();
    console.log('Received crop data:', data);

    // Map the backend response to the Crop type expected by the frontend
    const cropDetails: Crop = {
      id: data.id,
      name: data.name,
      imageURL: data.imageURL,
      scientific_name: data.scientific_name,
      description: data.description,
      origin: data.origin,
      growing_conditions: data.growing_conditions,
      planting_info: data.planting_info,
      care_instructions: data.care_instructions,
      storage_info: data.storage_info,
      nutritional_info: data.nutritional_info,
      culinary_info: data.culinary_info,
      sunlight: data.sunlight,
      waterNeeds: data.waterNeeds,
      companionCrops: [],
    };

    return cropDetails;
  } catch (error) {
    console.error('Error fetching crop details:', error);
    
    // Fallback to mock data if the API call fails
    const foundCrop = mockCrops.find(
      crop => crop.name.toLowerCase() === cropName.toLowerCase()
    );
    
    return foundCrop || null;
  }
};