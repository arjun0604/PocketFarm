
import { Crop, Nursery } from '../types/cropTypes';

// Mock crops data
export const mockCrops: Crop[] = [
  {
    id: '1',
    name: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    image: 'https://images.unsplash.com/photo-1524593166156-312f362cada0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
    sunlight: 'Full',
    waterNeeds: 'Medium',
    growthDuration: '70-90 days',
    description: 'Tomatoes are the most popular garden vegetable crop. They are warm-season plants that grow best in full sun and well-drained soil.',
    harvestTime: 'Summer to Fall',
    companionPlants: ['Basil', 'Marigold', 'Onions']
  },
  {
    id: '2',
    name: 'Basil',
    scientificName: 'Ocimum basilicum',
    image: 'https://images.unsplash.com/photo-1594027308808-573139c4aedb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
    sunlight: 'Full',
    waterNeeds: 'Medium',
    growthDuration: '50-70 days',
    description: 'Basil is a warm-weather, fragrant herb that tastes great in many dishes, especially Italian cuisine.',
    harvestTime: 'Summer',
    companionPlants: ['Tomato', 'Pepper', 'Marigold']
  },
  {
    id: '3',
    name: 'Cucumber',
    scientificName: 'Cucumis sativus',
    image: 'https://images.unsplash.com/photo-1589621316382-008455b857cd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
    sunlight: 'Full',
    waterNeeds: 'High',
    growthDuration: '50-70 days',
    description: 'Cucumbers are warm-season vegetables that grow on vines. They are mostly water and have a cool, crisp taste.',
    harvestTime: 'Summer',
    companionPlants: ['Sunflower', 'Corn', 'Beans']
  },
  {
    id: '4',
    name: 'Lettuce',
    scientificName: 'Lactuca sativa',
    image: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1445&q=80',
    sunlight: 'Partial',
    waterNeeds: 'Medium',
    growthDuration: '30-60 days',
    description: 'Lettuce is a cool-season crop that grows best in spring and fall. It\'s easy to grow and can be harvested at any stage of growth.',
    harvestTime: 'Spring and Fall',
    companionPlants: ['Carrots', 'Radishes', 'Cucumber']
  },
  {
    id: '5',
    name: 'Radish',
    scientificName: 'Raphanus sativus',
    image: 'https://images.unsplash.com/photo-1626921061155-5784640692085?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
    sunlight: 'Partial',
    waterNeeds: 'Medium',
    growthDuration: '20-30 days',
    description: 'Radishes are cool-season, fast-growing, easy-to-grow vegetables. Spring varieties grow best in cool weather of early spring and fall.',
    harvestTime: 'Spring and Fall',
    companionPlants: ['Lettuce', 'Spinach', 'Carrots']
  },
  {
    id: '6',
    name: 'Carrot',
    scientificName: 'Daucus carota',
    image: 'https://images.unsplash.com/photo-1582515073490-39981397c445?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1469&q=80',
    sunlight: 'Full',
    waterNeeds: 'Medium',
    growthDuration: '70-80 days',
    description: 'Carrots are root vegetables that are rich in vitamins, especially beta-carotene. They grow best in loose, sandy soil free of rocks.',
    harvestTime: 'Spring to Fall',
    companionPlants: ['Onions', 'Leeks', 'Rosemary']
  },
  {
    id: '7',
    name: 'Bell Pepper',
    scientificName: 'Capsicum annuum',
    image: 'https://images.unsplash.com/photo-1599253750896-8eff9a774799?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
    sunlight: 'Full',
    waterNeeds: 'Medium',
    growthDuration: '60-90 days',
    description: 'Bell peppers are warm-season crops that come in various colors including green, red, yellow, orange, and purple.',
    harvestTime: 'Summer to Fall',
    companionPlants: ['Basil', 'Onions', 'Spinach']
  },
  {
    id: '8',
    name: 'Spinach',
    scientificName: 'Spinacia oleracea',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80',
    sunlight: 'Partial',
    waterNeeds: 'Medium',
    growthDuration: '40-50 days',
    description: 'Spinach is a cool-season crop, perfect for fall or spring gardens. It\'s packed with nutrients and grows quickly.',
    harvestTime: 'Spring and Fall',
    companionPlants: ['Strawberry', 'Cabbage', 'Peas']
  }
];

// Mock nurseries data
export const mockNurseries: Nursery[] = [
  {
    id: '1',
    name: 'Green Thumb Nursery',
    type: 'nursery',
    address: '123 Garden St, Sample City',
    distance: 2.4,
    rating: 4.5,
    phone: '555-123-4567',
    website: 'www.greenthumb.example.com',
    latitude: 37.785,
    longitude: -122.437
  },
  {
    id: '2',
    name: 'Fertile Ground Garden Center',
    type: 'nursery',
    address: '456 Plant Ave, Sample City',
    distance: 3.7,
    rating: 4.8,
    phone: '555-234-5678',
    website: 'www.fertileground.example.com',
    latitude: 37.795,
    longitude: -122.427
  },
  {
    id: '3',
    name: 'Farming Essentials Store',
    type: 'store',
    address: '789 Fertilizer Blvd, Sample City',
    distance: 1.8,
    rating: 4.2,
    phone: '555-345-6789',
    latitude: 37.775,
    longitude: -122.417
  },
  {
    id: '4',
    name: 'Organic Growth Supplies',
    type: 'store',
    address: '101 Compost Rd, Sample City',
    distance: 5.2,
    rating: 4.0,
    website: 'www.organicgrowth.example.com',
    latitude: 37.765,
    longitude: -122.447
  }
];
