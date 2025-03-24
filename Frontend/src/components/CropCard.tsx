import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, Droplets, Clock, CalendarDays, Info, ChevronDown, ChevronUp, Calendar as CalendarIcon } from 'lucide-react';
import { Crop } from '@/utils/types/cropTypes';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useGarden } from '@/context/GardenContext';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CropCardProps {
  crop: Crop;
  onSelect?: () => void;
  selected?: boolean;
  onSelectCompanion?: (companionCropNames: string[]) => void;
  onAddToGarden?: () => Promise<void>;
  onRemoveFromGarden?: (cropName: string) => Promise<void>;
  onScheduleClick?: () => void;
  hasSchedule?: boolean;
}

const CropCard: React.FC<CropCardProps> = ({ 
  crop, 
  onSelect, 
  selected = false, 
  onSelectCompanion,
  onAddToGarden,
  onRemoveFromGarden,
  onScheduleClick,
  hasSchedule = false
}) => {
  const [showMore, setShowMore] = useState(false);
  const { user } = useAuth();
  const { userCrops, addCropToGarden, removeCropFromGarden } = useGarden();

  const isInGarden = userCrops.includes(crop.name);

  const handleAddToGarden = async () => {
    if (onAddToGarden) {
      await onAddToGarden();
    } else {
      try {
        if (!user?.id) {
          toast.error('User not authenticated. Please log in again.');
          return;
        }

        if (isInGarden) {
          toast.error('This crop is already in your garden.');
          return;
        }

        await addCropToGarden(crop.name);
        toast.success(`${crop.name} added to your garden!`);
        if (onSelect) {
          onSelect();
        }
      } catch (error) {
        console.error('Error adding crop to garden:', error);
        toast.error('Failed to add crop to garden. Please try again.');
      }
    }
  };

  const handleRemoveFromGarden = async () => {
    if (onRemoveFromGarden) {
      await onRemoveFromGarden(crop.name);
    } else {
      try {
        if (!user?.id) {
          toast.error('User not authenticated. Please log in again.');
          return;
        }

        await removeCropFromGarden(crop.name);
        toast.success(`${crop.name} removed from your garden!`);
        if (onSelect) {
          onSelect();
        }
      } catch (error) {
        console.error('Error removing crop from garden:', error);
        toast.error('Failed to remove crop from garden. Please try again.');
      }
    }
  };

  const handleCompanionCropClick = () => {
    if (crop.companion_crops && crop.companion_crops.length > 0 && onSelectCompanion) {
      onSelectCompanion(crop.companion_crops);
    }
  };

  return (
    <Card className={`h-full flex flex-col transition-all hover:shadow-md ${selected ? 'ring-2 ring-primary' : ''}`}>
      {/* Crop Image */}
      <div className="aspect-video w-full overflow-hidden rounded-t-lg">
        <img 
          src={crop.imageURL}
          alt={crop.name}
          className="w-full h-full object-cover transition-transform hover:scale-105"
        />
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-primary">{crop.name}</CardTitle>
        <CardDescription className="text-xs italic">{crop.scientific_name}</CardDescription>
      </CardHeader>

      <CardContent className="flex-grow space-y-2 pb-2">
        {/* Essential Crop Details */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="flex items-center gap-1 bg-muted/50">
            <Sun className="h-3 w-3 text-yellow-500" />
            {crop.sunlight} Sun
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 bg-muted/50">
            <Droplets className="h-3 w-3 text-blue-500" />
            {crop.waterNeeds} Water
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1 bg-muted/50">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {crop.growing_conditions}
          </Badge>
        </div>

        <p className="text-sm line-clamp-3">{crop.description}</p>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          <span>Harvest: {crop.planting_info}</span>
        </div>

        {crop.companion_crops && crop.companion_crops.length > 0 && (
          <div className="text-xs">
            <span className="font-medium">Companion plants: </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectCompanion?.(crop.companion_crops);
              }}
              className="text-primary hover:underline"
            >
              {crop.companion_crops.join(', ')}
            </button>
          </div>
        )}

        {/* Show More Details */}
        <div className="flex items-center justify-between mt-2">
          <Button
            variant="ghost"
            className="text-primary flex items-center gap-1 text-sm"
            onClick={() => setShowMore(!showMore)}
          >
            {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showMore ? "Show Less" : "Show More"}
          </Button>
          {isInGarden && hasSchedule && (
            <Button
              variant="ghost"
              className="text-primary flex items-center gap-1 text-sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onScheduleClick?.();
              }}
            >
              <CalendarIcon className="h-4 w-4" />
              Schedule
            </Button>
          )}
        </div>

        {showMore && (
          <div className="mt-3 p-2 bg-muted rounded-lg text-xs space-y-2">
            <p><b>Origin:</b> {crop.origin}</p>
            <p><b>Care Instructions:</b> {crop.care_instructions}</p>
            <p><b>Storage Info:</b> {crop.storage_info}</p>
            <p><b>Nutritional Info:</b> {crop.nutritional_info}</p>
            <p><b>Culinary Uses:</b> {crop.culinary_info}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="mt-auto space-y-2">
        <div className="w-full flex justify-center">
          {isInGarden ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFromGarden();
              }}
            >
              Remove from Garden
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                handleAddToGarden();
              }}
            >
              Add to My Garden
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default CropCard;