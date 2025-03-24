import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useGarden } from '@/context/GardenContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sun, Droplets, Clock, CalendarDays, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Crop } from '@/utils/types/cropTypes';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Calendar } from '@/components/ui/calendar';
import BottomNavigation from '@/components/BottomNavigation';
import { useNavigationHistory } from '@/utils/useNavigationHistory';

interface UserCropSchedule {
  id: number;
  name: string;
  imageURL: string;
  last_watered: string | null;
  next_watering: string;
  growing_time: number;
  watering_frequency: number;
  fertilization_schedule: number;
  water_status: boolean;
}

interface Notification {
  id: number;
  message: string;
  timestamp: string;
  read: boolean;
}

const WateringSchedule: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { userCrops } = useGarden();
  const [selectedCrop, setSelectedCrop] = useState<UserCropSchedule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const queryClient = useQueryClient();
  const [wateredCrops, setWateredCrops] = useState<Set<string>>(new Set());
  const [isWateringToday, setIsWateringToday] = useState<boolean>(true);
  const [localWateredStatus, setLocalWateredStatus] = useState<Record<string, boolean>>({});
  const { goBack } = useNavigationHistory('/garden');

  // Fetch user's crop schedules
  const { data: cropSchedules, isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['userCropSchedules', user?.id],
    queryFn: async () => {
      if (!user) return [];
      try {
        const response = await axios.get(`http://127.0.0.1:5000/user_schedule/${Number(user.id)}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching schedules:', error);
        return [];
      }
    },
    enabled: !!user,
  });

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

  // Update localWateredStatus when cropSchedules changes
  useEffect(() => {
    if (cropSchedules) {
      const newStatus: Record<string, boolean> = {};
      cropSchedules.forEach((crop: UserCropSchedule) => {
        newStatus[crop.name] = crop.water_status;
      });
      setLocalWateredStatus(newStatus);
    }
  }, [cropSchedules]);

  // Mutation for updating watering status
  const updateWateringMutation = useMutation({
    mutationFn: async ({ user_id, crop_name, water_status }: { user_id: number; crop_name: string; water_status: boolean }) => {
      const response = await axios.post('http://127.0.0.1:5000/update_watering', {
        user_id,
        crop_name,
        water_status,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userCropSchedules', user?.id] });
      toast.success(
        `🎉 Great job! You've watered your ${variables.crop_name} today! Keep up the good work! 🌱`,
        {
          duration: 5000,
        }
      );
    },
    onError: (error) => {
      toast.error('Failed to update watering status');
      console.error('Error updating watering:', error);
    }
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (userNotifications) {
      setNotifications(userNotifications);
    }
  }, [userNotifications]);

  const getWateringDates = (crop: UserCropSchedule) => {
    const dates: Date[] = [];
    const startDate = crop.last_watered ? parseISO(crop.last_watered) : new Date();
    const endDate = addDays(startDate, crop.growing_time);

    let currentDate = startDate;
    while (currentDate <= endDate) {
      dates.push(currentDate);
      currentDate = addDays(currentDate, crop.watering_frequency);
    }
    return dates;
  };

  const getFertilizationDates = (crop: UserCropSchedule) => {
    const dates: Date[] = [];
    const startDate = crop.last_watered ? parseISO(crop.last_watered) : new Date();
    const endDate = addDays(startDate, crop.growing_time);

    let currentDate = startDate;
    while (currentDate <= endDate) {
      dates.push(currentDate);
      currentDate = addDays(currentDate, crop.fertilization_schedule);
    }
    return dates;
  };

  // This function checks if a crop needs watering today
  const needsWateringToday = (crop: UserCropSchedule) => {
    if (!crop.next_watering) return false;
    
    // Parse next watering date
    const nextWateringDate = parseISO(crop.next_watering);
    const today = new Date();
    
    // Add some logging to debug
    console.log(`Crop ${crop.name}: Next watering: ${format(nextWateringDate, 'yyyy-MM-dd')}, Today: ${format(today, 'yyyy-MM-dd')}, Same day: ${isSameDay(nextWateringDate, today)}`);
    
    return isSameDay(nextWateringDate, today);
  };

  const toggleWatering = (crop: UserCropSchedule) => {
    if (!user?.id) return;

    // Get current status
    const currentStatus = localWateredStatus[crop.name] === true;
    
    // Toggle to opposite state
    const newStatus = !currentStatus;
    
    console.log(`Toggling watering for ${crop.name}. Current: ${currentStatus}, New: ${newStatus}`);

    // Update local state immediately with the toggled value
    setLocalWateredStatus(prev => {
      const updatedStatus = {...prev};
      updatedStatus[crop.name] = newStatus;
      return updatedStatus;
    });

    // Show appropriate toast based on new status
    if (newStatus) {
      toast.success(`Watering ${crop.name}! 💧`, { 
        duration: 2000,
        position: 'top-center' 
      });
    } else {
      toast.info(`Unmarked ${crop.name} as watered`, { 
        duration: 2000,
        position: 'top-center' 
      });
    }

    // Make API request to update backend
    updateWateringMutation.mutate({
      user_id: Number(user.id),
      crop_name: crop.name,
      water_status: newStatus // Send the new status to backend
    }, {
      onError: () => {
        // Revert state on error (back to original)
        setLocalWateredStatus(prev => {
          const revertedStatus = {...prev};
          revertedStatus[crop.name] = currentStatus;
          return revertedStatus;
        });
        toast.error('Failed to update watering status');
      }
    });
  };

  // Get button state for a crop - with improved logging
  const getButtonState = (crop: UserCropSchedule) => {
    // Use local state for immediate UI updates
    const isWatered = localWateredStatus[crop.name] === true;
    const shouldWaterToday = needsWateringToday(crop);
    
    console.log(`Button state for ${crop.name}: watered=${isWatered}, needsWatering=${shouldWaterToday}`);
    
    // First check if already watered today
    if (isWatered) {
      return {
        text: '✅ Already Watered (Click to Undo)',
        className: 'bg-green-600 hover:bg-green-500 text-white',
        disabled: false, // Not disabled anymore to allow toggling
        variant: 'secondary' as const,
        icon: <Droplets className="h-4 w-4 mr-2 text-white" />
      };
    }
    
    // Then check if watering is needed today
    if (!shouldWaterToday) {
      return {
        text: `🚫 No Watering Today`,
        className: 'bg-gray-200 text-gray-700',
        disabled: true, // Still disabled since no watering needed
        variant: 'outline' as const,
        icon: <CalendarDays className="h-4 w-4 mr-2" />
      };
    }

    // Default case - watering needed today
    return {
      text: '💧 Mark as Watered',
      className: 'bg-blue-500 hover:bg-blue-600 text-white',
      disabled: false,
      variant: 'default' as const,
      icon: <Droplets className="h-4 w-4 mr-2" />
    };
  };

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header 
        title="Watering Schedule" 
        showBackButton 
        onBackClick={goBack}
        notifications={notifications}
      />
      
      <main className="container mx-auto px-4 py-8">
        {isLoadingSchedules ? (
          <div className="text-center py-12">
            <p>Loading your watering schedule...</p>
          </div>
        ) : cropSchedules && cropSchedules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {cropSchedules.map((crop: UserCropSchedule) => {
              const buttonState = getButtonState(crop);
              return (
                <Card key={crop.id} className="border-pocketfarm-secondary/30">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-pocketfarm-primary">{crop.name}</CardTitle>
                    <CardDescription>
                      Last watered: {crop.last_watered ? format(parseISO(crop.last_watered), 'MMM dd, yyyy') : 'Never'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-blue-500" />
                        <span>Next watering: {format(parseISO(crop.next_watering), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-green-500" />
                        <span>Growing time: {crop.growing_time} days</span>
                      </div>
                    </div>
                  </CardContent>
                  <div className="p-4 pt-0 space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => {
                        setSelectedCrop(crop);
                        setIsDialogOpen(true);
                      }}
                    >
                      View Schedule
                    </Button>
                    <Button 
                      onClick={() => toggleWatering(crop)}
                      className={`w-full transition-all duration-300 ${buttonState.className}`}
                      disabled={buttonState.disabled || updateWateringMutation.isPending}
                      variant={buttonState.variant}
                    >
                      {buttonState.icon}
                      {updateWateringMutation.isPending && updateWateringMutation.variables?.crop_name === crop.name
                        ? 'Updating...' 
                        : buttonState.text}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="mb-4">No crops in your garden yet</p>
            <Button onClick={() => navigate('/recommendations')}>Find Crops to Grow</Button>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedCrop?.name} Schedule</DialogTitle>
              <DialogDescription>
                View and manage the watering schedule for {selectedCrop?.name}.
              </DialogDescription>
            </DialogHeader>
            
            {selectedCrop && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Growing Time</h4>
                    <p>{selectedCrop.growing_time} days</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Watering Frequency</h4>
                    <p>Every {selectedCrop.watering_frequency} days</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Fertilization Schedule</h4>
                    <p>Every {selectedCrop.fertilization_schedule} days</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Next Watering</h4>
                    <p>{format(parseISO(selectedCrop.next_watering), 'MMM dd, yyyy')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border rounded-lg p-4 bg-white">
                    <h4 className="font-semibold mb-4 text-center">Calendar</h4>
                    <Calendar
                      mode="single"
                      selected={parseISO(selectedCrop.next_watering)}
                      modifiers={{
                        watering: getWateringDates(selectedCrop),
                        fertilization: getFertilizationDates(selectedCrop),
                      }}
                      modifiersStyles={{
                        watering: { backgroundColor: '#e0f2fe', color: '#0369a1' },
                        fertilization: { backgroundColor: '#fae8ff', color: '#7e22ce' },
                      }}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Growing Timeline</h4>
                      <div className="space-y-2">
                        <p>• Plant started: {selectedCrop.last_watered ? format(parseISO(selectedCrop.last_watered), 'MMM dd, yyyy') : 'Not started'}</p>
                        <p>• Next watering: {format(parseISO(selectedCrop.next_watering), 'MMM dd, yyyy')}</p>
                        <p>• Expected harvest: {selectedCrop.last_watered ? format(addDays(parseISO(selectedCrop.last_watered), selectedCrop.growing_time), 'MMM dd, yyyy') : 'Not started'}</p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        onClick={() => toggleWatering(selectedCrop)}
                        className={`w-full transition-all duration-300 ${selectedCrop ? getButtonState(selectedCrop).className : ''}`}
                        disabled={(selectedCrop ? getButtonState(selectedCrop).disabled : true) || updateWateringMutation.isPending}
                        variant={selectedCrop ? getButtonState(selectedCrop).variant : 'default'}
                      >
                        {selectedCrop ? getButtonState(selectedCrop).icon : <Droplets className="h-4 w-4 mr-2" />}
                        {updateWateringMutation.isPending && selectedCrop && updateWateringMutation.variables?.crop_name === selectedCrop.name
                          ? 'Updating...' 
                          : selectedCrop ? getButtonState(selectedCrop).text : ''}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default WateringSchedule;