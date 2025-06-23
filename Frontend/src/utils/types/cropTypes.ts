export interface Crop {
  id: number;
  name: string;
  scientific_name: string;
  imageURL: string;
  description: string;
  origin: string;
  growing_conditions: string;
  planting_info: string;
  care_instructions: string;
  storage_info: string;
  nutritional_info: string;
  culinary_info: string;
  sunlight: 'Full' | 'Partial';
  waterNeeds: 'Low' | 'Medium' | 'High';
  companion_crops: string[];
  recommended_info: {
    Crop: string;
    'Avg Area': number;
    Drainage: string;
    'Companion Crop 1': string;
    'Companion Crop 2': string;
  };
}

export interface GrowingConditions {
  sunlight: 'Full' | 'Partial';
  waterNeeds: 'Low' | 'Medium' | 'High';
  area: number;
  wantCompanion: boolean;
  location: {
    latitude: number;
    longitude: number;
    city?: string;
  };
}

export interface Nursery {
  id: string;
  name: string;
  type: 'nursery' | 'store';
  businessType: string;
  address: string;
  distance: number;
  rating: number;
  phone?: string;
  website?: string;
  latitude: number;
  longitude: number;
  lat?: number;
  lon?: number;
  address_loading?: boolean;
}
