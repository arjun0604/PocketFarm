import { Crop } from '../types/cropTypes';

export const saveCropSelection = async (cropId: string, deviceToken: string) => {
  try {
    const response = await fetch('http://127.0.0.1:5000/add_to_library', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        crop_name: cropId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to add crop to library');
    }

    return true; // Indicate success
  } catch (error) {
    console.error('Error saving crop selection:', error);
    return false; // Indicate failure
  }
};

export const getUserCrops = async (deviceToken: string): Promise<string[]> => {
  try {
    const response = await fetch('http://127.0.0.1:5000/get_user_crops', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${deviceToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user crops');
    }

    const cropNames = await response.json();
    return cropNames;
  } catch (error) {
    console.error('Error fetching user crops:', error);
    return [];
  }
};

export const getUserCropDetails = async (deviceToken: string): Promise<Crop[]> => {
  const cropNames = await getUserCrops(deviceToken);

  // Fetch details for each crop
  const cropsWithDetails = await Promise.all(
    cropNames.map(async (cropName: string) => {
      const response = await fetch(`http://127.0.0.1:5000/crop/${cropName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch details for ${cropName}`);
      }
      return response.json();
    })
  );

  return cropsWithDetails;
};