import React, { useState, useEffect } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Home, Search, MapPin, ChevronLeft, Droplets, X, User, LogOut } from 'lucide-react'; // Added User and LogOut icons
import CropRecommendationForm from '@/components/CropRecommendationForm';
import CropCard from '@/components/CropCard';
import { GrowingConditions, Crop } from '@/utils/types/cropTypes';
import { getUserLocation } from '@/utils/locationUtils';
import { toast } from 'sonner';
import { useGarden } from '@/context/GardenContext';
import BottomNavigation from '@/components/BottomNavigation';
import Header from '@/components/Header';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigationHistory } from '@/utils/useNavigationHistory';

interface Notification {
  id: number;
  message: string;
  timestamp: string;
  read: boolean;
}

const Recommendations: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [showForm, setShowForm] = useState(true);
  const [visibleCrops, setVisibleCrops] = useState(4);
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [companionCrops, setCompanionCrops] = useState<Crop[]>([]);
  const [wantCompanion, setWantCompanion] = useState<boolean>(false);
  const { userCrops, addCropToGarden, removeCropFromGarden } = useGarden();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { goBack } = useNavigationHistory();

  useEffect(() => {
    const location = getUserLocation();
    if (!location) {
      toast.info('Please allow location access on the Dashboard for better recommendations.');
    }
  }, []);

  const handleSubmit = async (conditions: GrowingConditions) => {
    setIsLoading(true);
    setShowForm(false);
    setWantCompanion(conditions.wantCompanion);
    try {
      const response = await fetch('http://127.0.0.1:5000/recommend', {
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

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();
      console.log('Received data from backend:', data); // Debug log
      
      // Process the crops data to include companion crops
      const processedCrops = data.map((crop: any) => {
        const companionCrops = [];
        if (crop.recommended_info) {
          if (crop.recommended_info['Companion Crop 1']) {
            companionCrops.push(crop.recommended_info['Companion Crop 1']);
          }
          if (crop.recommended_info['Companion Crop 2']) {
            companionCrops.push(crop.recommended_info['Companion Crop 2']);
          }
        }
        return {
          ...crop,
          companion_crops: companionCrops
        };
      });
      
      console.log('Processed crops:', processedCrops); // Debug log
      setCrops(processedCrops);

      // If companion crops are requested, fetch their details
      if (conditions.wantCompanion) {
        const companionCropNames = processedCrops.flatMap((crop: any) => crop.companion_crops || []);
        const uniqueCompanionNames = [...new Set(companionCropNames)];
        console.log('Unique companion crop names:', uniqueCompanionNames); // Debug log
        
        const companionDetails = await Promise.all(
          uniqueCompanionNames.map(async (name: string) => {
            try {
              const response = await fetch(`http://127.0.0.1:5000/crop/${encodeURIComponent(name)}`);
              if (response.ok) {
                const data = await response.json();
                console.log(`Fetched companion crop details for ${name}:`, data); // Debug log
                return data;
              }
              console.warn(`Companion crop not found: ${name}`);
              return null;
            } catch (error) {
              console.error(`Error fetching companion crop ${name}:`, error);
              return null;
            }
          })
        );

        const validCompanionCrops = companionDetails.filter((crop): crop is Crop => crop !== null);
        console.log('Valid companion crops:', validCompanionCrops); // Debug log
        setCompanionCrops(validCompanionCrops);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      toast.error('Failed to get recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToGarden = async (crop: Crop) => {
    try {
      await addCropToGarden(crop.name);
      toast.success(`${crop.name} added to your garden!`);
      // Only set selectedCrop if it's not already set (i.e., not in companion crops window)
      if (!selectedCrop) {
        setSelectedCrop(crop);
      }
    } catch (error) {
      console.error('Error adding crop to garden:', error);
      toast.error('Failed to add crop to garden. Please try again.');
    }
  };

  const handleReset = () => {
    setShowForm(true);
    setCrops([]);
    setVisibleCrops(4);
  };

  const loadMore = () => {
    setVisibleCrops((prev) => prev + 4);
  };

  // Fetch notifications
  const { data: userNotifications } = useQuery({
    queryKey: ['userNotifications', user?.id],
    queryFn: async () => {
      if (!user) return [];
      try {
        const response = await axios.get(`http://127.0.0.1:5000/notifications/${Number(user.id)}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (userNotifications) {
      setNotifications(userNotifications);
    }
  }, [userNotifications]);

  const handleCompanionCropSelect = (crop: Crop, companionCropNames: string[]) => {
    setSelectedCrop(crop);
  };

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header 
        title="Crop Recommendations" 
        showBackButton 
        onBackClick={goBack}
        notifications={notifications}
      />
      
      <main className="container mx-auto px-4 py-6">
        {showForm ? (
          <CropRecommendationForm onSubmit={handleSubmit} />
        ) : (
          <div className="space-y-6">
            {isLoading ? (
              <div className="text-center py-12">
                <p>Finding the perfect crops for you...</p>
              </div>
            ) : crops.length > 0 ? (
              <>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-primary mb-2">
                    Your Personalized Recommendations
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    These crops are suited to your growing conditions and location
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {crops.slice(0, visibleCrops).map((crop) => (
                    <div key={crop.id}>
                      <CropCard
                        crop={crop}
                        onAddToGarden={() => handleAddToGarden(crop)}
                        onRemoveFromGarden={() => removeCropFromGarden(crop.name)}
                        onSelectCompanion={(companionCropNames) => handleCompanionCropSelect(crop, companionCropNames)}
                      />
                    </div>
                  ))}
                </div>
                {visibleCrops < crops.length && (
                  <div className="text-center mt-8">
                    <Button
                      onClick={loadMore}
                    >
                      Load More Recommendations
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="mb-4">No crops match your criteria</p>
                <Button onClick={handleReset}>Try Different Conditions</Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Hovering Window for Companion Crops */}
      {selectedCrop && selectedCrop.companion_crops && selectedCrop.companion_crops.length > 0 && wantCompanion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Companion Plants for {selectedCrop.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedCrop(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {companionCrops
                .filter(crop => selectedCrop.companion_crops.includes(crop.name))
                .map((crop) => (
                  <CropCard
                    key={crop.id}
                    crop={crop}
                    onAddToGarden={() => handleAddToGarden(crop)}
                    onRemoveFromGarden={() => removeCropFromGarden(crop.name)}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
};

export default Recommendations;