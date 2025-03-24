import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserLocation } from '@/utils/locationUtils';
import { Sun, Droplets, Maximize, SproutIcon, MapPin, Clock } from 'lucide-react';
import { GrowingConditions } from '@/utils/types/cropTypes';
import { toast } from 'sonner';

interface CropRecommendationFormProps {
  onSubmit: (conditions: GrowingConditions) => void;
}

const CropRecommendationForm: React.FC<CropRecommendationFormProps> = ({ onSubmit }) => {
  const navigate = useNavigate();
  const location = getUserLocation();
  
  const [sunlight, setSunlight] = useState<'Full' | 'Partial'>('Full');
  const [waterNeeds, setWaterNeeds] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [area, setArea] = useState<number>(10);
  const [wantCompanion, setWantCompanion] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (!location) {
      toast.error('Location information is required for recommendations');
      setIsSubmitting(false);
      return;
    }
    
    const conditions: GrowingConditions = {
      sunlight,
      waterNeeds,
      area,
      wantCompanion,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city
      }
    };
    
    onSubmit(conditions);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl text-primary flex items-center gap-2">
          <SproutIcon className="h-5 w-5" />
          Find Your Perfect Crops
        </CardTitle>
        <CardDescription>
          Tell us about your growing conditions and we'll recommend crops that will thrive
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-medium flex items-center gap-2">
              <Sun className="h-4 w-4 text-yellow-500" />
              Sunlight Availability
            </Label>
            <RadioGroup defaultValue={sunlight} onValueChange={(value) => setSunlight(value as 'Full' | 'Partial')} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Full" id="sunlight-full" />
                <Label htmlFor="sunlight-full" className="font-normal">Full Sun (6+ hours of direct sunlight)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Partial" id="sunlight-partial" />
                <Label htmlFor="sunlight-partial" className="font-normal">Partial Sun (3-6 hours of direct sunlight)</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-3">
            <Label className="text-base font-medium flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-500" />
              Water Availability
            </Label>
            <RadioGroup defaultValue={waterNeeds} onValueChange={(value) => setWaterNeeds(value as 'High' | 'Medium' | 'Low')} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="High" id="water-high" />
                <Label htmlFor="water-high" className="font-normal">High (Regular watering, moisture-retaining soil)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Medium" id="water-medium" />
                <Label htmlFor="water-medium" className="font-normal">Medium (Moderate watering, well-draining soil)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Low" id="water-low" />
                <Label htmlFor="water-low" className="font-normal">Low (Minimal watering, drought-resistant plants)</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="area" className="text-base font-medium flex items-center gap-2">
              <Maximize className="h-4 w-4 text-muted-foreground" />
              Growing Area (square feet)
            </Label>
            <Input
              id="area"
              type="number"
              min="1"
              value={area}
              onChange={(e) => setArea(Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch 
              id="companion" 
              checked={wantCompanion}
              onCheckedChange={setWantCompanion}
            />
            <Label htmlFor="companion" className="text-base">I'm interested in companion planting</Label>
          </div>
          
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Finding crops...' : 'Get Crop Recommendations'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CropRecommendationForm;
