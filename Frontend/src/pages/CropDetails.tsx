import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useGarden } from '@/context/GardenContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, Droplets, Clock, CalendarDays, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Crop } from '@/utils/types/cropTypes';
import { toast } from 'sonner';
import Header from '@/components/Header';
import axios from 'axios';
import { useNavigationHistory } from '@/utils/useNavigationHistory';

const CropDetails: React.FC = () => {
  const { cropName } = useParams<{ cropName: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { userCrops, addCropToGarden, removeCropFromGarden } = useGarden();
  const [crop, setCrop] = useState<Crop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const { goBack } = useNavigationHistory();

  useEffect(() => {
    const fetchCropDetails = async () => {
      if (!cropName) return;

      try {
        const response = await axios.get(`http://127.0.0.1:5000/crop/${encodeURIComponent(cropName)}`);
        setCrop(response.data);
      } catch (error) {
        console.error('Error fetching crop details:', error);
        toast.error('Failed to load crop details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCropDetails();
  }, [cropName]);

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          title="Crop Details" 
          showBackButton 
          onBackClick={goBack}
        />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </main>
      </div>
    );
  }

  if (!crop) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          title="Crop Details" 
          showBackButton 
          onBackClick={goBack}
        />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">Crop not found</div>
        </main>
      </div>
    );
  }

  const isInGarden = userCrops.includes(crop.name);

  const handleAddToGarden = async () => {
    try {
      await addCropToGarden(crop.name);
      toast.success(`${crop.name} added to your garden!`);
    } catch (error) {
      console.error('Error adding crop to garden:', error);
      toast.error('Failed to add crop to garden. Please try again.');
    }
  };

  const handleRemoveFromGarden = async () => {
    try {
      await removeCropFromGarden(crop.name);
      toast.success(`${crop.name} removed from your garden!`);
    } catch (error) {
      console.error('Error removing crop from garden:', error);
      toast.error('Failed to remove crop from garden. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title="Crop Details" 
        showBackButton 
        onBackClick={goBack}
      />
      
      <main className="container mx-auto px-4 py-8">
        <Card>
          {/* Crop Image */}
          <div className="aspect-video w-full overflow-hidden rounded-t-lg">
            <img 
              src={crop.imageURL}
              alt={crop.name}
              className="w-full h-full object-cover"
            />
          </div>

          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">{crop.name}</CardTitle>
            <CardDescription className="text-sm italic">{crop.scientific_name}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Essential Crop Details */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="flex items-center gap-1 bg-muted/50">
                <Sun className="h-4 w-4 text-yellow-500" />
                {crop.sunlight} Sun
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1 bg-muted/50">
                <Droplets className="h-4 w-4 text-blue-500" />
                {crop.waterNeeds} Water
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1 bg-muted/50">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {crop.growing_conditions}
              </Badge>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{crop.description}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Planting Information</h3>
                <p className="text-sm text-muted-foreground">{crop.planting_info}</p>
              </div>

              {crop.companion_crops && crop.companion_crops.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Companion Plants</h3>
                  <p className="text-sm text-muted-foreground">{crop.companion_crops.join(', ')}</p>
                </div>
              )}

              <Button
                variant="ghost"
                className="text-primary flex items-center gap-1 text-sm"
                onClick={() => setShowMore(!showMore)}
              >
                {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showMore ? "Show Less" : "Show More"}
              </Button>

              {showMore && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Origin</h3>
                    <p className="text-sm text-muted-foreground">{crop.origin}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Care Instructions</h3>
                    <p className="text-sm text-muted-foreground">{crop.care_instructions}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Storage Information</h3>
                    <p className="text-sm text-muted-foreground">{crop.storage_info}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Nutritional Information</h3>
                    <p className="text-sm text-muted-foreground">{crop.nutritional_info}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Culinary Uses</h3>
                    <p className="text-sm text-muted-foreground">{crop.culinary_info}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center mt-6">
              {isInGarden ? (
                <Button
                  variant="outline"
                  className="w-full bg-red-500 text-white hover:bg-red-600"
                  onClick={handleRemoveFromGarden}
                >
                  Remove from Garden
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleAddToGarden}
                >
                  Add to My Garden
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CropDetails; 