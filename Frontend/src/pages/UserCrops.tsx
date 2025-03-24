import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useGarden } from '@/context/GardenContext';
import { Button } from '@/components/ui/button';
import { Home, Search, MapPin, Droplets, User, Bell, LogOut, ChevronLeft, Calendar as CalendarIcon, Sprout } from 'lucide-react';
import CropCard from '@/components/CropCard';
import { Crop } from '@/utils/types/cropTypes';
import { toast } from 'sonner';
import BottomNavigation from '@/components/BottomNavigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Calendar } from '@/components/ui/calendar';
import Header from '@/components/Header';
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

const UserCrops: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const { userCrops, removeCropFromGarden } = useGarden();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<UserCropSchedule | null>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { goBack } = useNavigationHistory();

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

  // Mutation for updating watering status
  const updateWateringMutation = useMutation({
    mutationFn: async ({ user_id, crop_name }: { user_id: number; crop_name: string }) => {
      const response = await axios.post('http://127.0.0.1:5000/update_watering', {
        user_id,
        crop_name,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userCropSchedules', user?.id] });
      toast.success(
        `🎉 Great job! You've watered your ${selectedCrop?.name} today! Keep up the good work! 🌱`,
        {
          duration: 5000,
        }
      );
    },
    onError: (error) => {
      toast.error('Failed to update watering status');
      console.error('Error updating watering:', error);
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    const fetchCropDetails = async () => {
      try {
        const cropDetails = await Promise.all(
          userCrops.map(async (cropName) => {
            const response = await axios.get(`http://127.0.0.1:5000/crop/${encodeURIComponent(cropName)}`);
            return response.data;
          })
        );
        setCrops(cropDetails);
      } catch (error) {
        console.error('Error fetching crop details:', error);
        toast.error('Failed to load your garden. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCropDetails();
  }, [isAuthenticated, navigate, userCrops]);

  useEffect(() => {
    if (userNotifications) {
      setNotifications(userNotifications);
    }
  }, [userNotifications]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out. Please try again.');
    }
  };

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

  const handleWateringResponse = async () => {
    if (!user || !selectedCrop) return;
    updateWateringMutation.mutate({
      user_id: Number(user.id),
      crop_name: selectedCrop.name,
    });
  };

  const hasBeenWateredToday = (crop: UserCropSchedule) => {
    if (!crop.last_watered) return false;
    const lastWateredDate = parseISO(crop.last_watered);
    const today = new Date();
    return isSameDay(lastWateredDate, today);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header 
        title="My Garden" 
        showBackButton={true} 
        onBackClick={goBack}
        notifications={notifications}
      />
      
      <main className="container mx-auto px-4 py-6">
        {isLoading || isLoadingSchedules ? (
          <div className="text-center py-12">
            <p>Loading your garden...</p>
          </div>
        ) : crops.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {crops.map((crop) => {
              const schedule = cropSchedules?.find(s => s.name === crop.name);
              return (
                <div key={crop.id} className="relative">
                  <CropCard
                    crop={crop}
                    onRemoveFromGarden={() => removeCropFromGarden(crop.name)}
                    hasSchedule={!!schedule}
                    onScheduleClick={() => {
                      if (schedule) {
                        setSelectedCrop(schedule);
                        setIsScheduleDialogOpen(true);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="mb-4">Your garden is empty</p>
            <Button onClick={() => navigate('/recommendations')}>Find Crops to Grow</Button>
          </div>
        )}
      </main>

      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-green-600 dark:text-green-400" />
              {selectedCrop?.name} Schedule
            </DialogTitle>
            <DialogDescription>
              View and manage the growing schedule for {selectedCrop?.name}.
            </DialogDescription>
          </DialogHeader>
          
          {selectedCrop && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                  <h4 className="font-semibold mb-2 text-blue-700 dark:text-blue-300">Growing Time</h4>
                  <p className="text-blue-900 dark:text-blue-100">{selectedCrop.growing_time} days</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950/50 rounded-lg">
                  <h4 className="font-semibold mb-2 text-green-700 dark:text-green-300">Watering Frequency</h4>
                  <p className="text-green-900 dark:text-green-100">Every {selectedCrop.watering_frequency} days</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-950/50 rounded-lg">
                  <h4 className="font-semibold mb-2 text-purple-700 dark:text-purple-300">Fertilization Schedule</h4>
                  <p className="text-purple-900 dark:text-purple-100">Every {selectedCrop.fertilization_schedule} days</p>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950/50 rounded-lg">
                  <h4 className="font-semibold mb-2 text-yellow-700 dark:text-yellow-300">Next Watering</h4>
                  <p className="text-yellow-900 dark:text-yellow-100">
                    {selectedCrop.next_watering ? format(parseISO(selectedCrop.next_watering), 'MMM dd, yyyy') : 'Not scheduled'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-4 bg-card">
                  <h4 className="font-semibold mb-4 text-center">Calendar</h4>
                  <Calendar
                    mode="single"
                    selected={selectedCrop.next_watering ? parseISO(selectedCrop.next_watering) : new Date()}
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
                  <div className="bg-muted rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Legend</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-100 dark:bg-blue-800 rounded"></div>
                        <span>Watering Days</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-purple-100 dark:bg-purple-800 rounded"></div>
                        <span>Fertilization Days</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-100 dark:bg-green-800 rounded"></div>
                        <span>Next Watering</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Growing Timeline</h4>
                    <div className="space-y-2">
                      <p>• Plant started: {selectedCrop.last_watered ? format(parseISO(selectedCrop.last_watered), 'MMM dd, yyyy') : 'Not started'}</p>
                      <p>• Next watering: {selectedCrop.next_watering ? format(parseISO(selectedCrop.next_watering), 'MMM dd, yyyy') : 'Not scheduled'}</p>
                      <p>• Expected harvest: {selectedCrop.last_watered ? format(addDays(parseISO(selectedCrop.last_watered), selectedCrop.growing_time), 'MMM dd, yyyy') : 'Not started'}</p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      onClick={handleWateringResponse} 
                      className="w-full"
                      disabled={updateWateringMutation.isPending || selectedCrop?.water_status}
                      variant={selectedCrop?.water_status ? "secondary" : "default"}
                    >
                      <Droplets className="h-4 w-4 mr-2" />
                      {updateWateringMutation.isPending 
                        ? 'Updating...' 
                        : selectedCrop?.water_status
                          ? 'Already Watered Today'
                          : 'Mark as Watered'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default UserCrops;