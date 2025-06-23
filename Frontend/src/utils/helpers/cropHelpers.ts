
import { Crop } from '../types/cropTypes';
import { mockCrops } from '../data/mockData';

export const searchCrops = (query: string): Crop[] => {
  if (!query.trim()) {
    return mockCrops;
  }
  
  const normalizedQuery = query.toLowerCase().trim();
  
  return mockCrops.filter(crop => 
    crop.name.toLowerCase().includes(normalizedQuery) ||
    crop.scientificName.toLowerCase().includes(normalizedQuery) ||
    crop.description.toLowerCase().includes(normalizedQuery)
  );
};
