import React, { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useGarden } from '@/context/GardenContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, Search, MapPin, LogOut, Bell, ChevronRight, Droplets, CloudRain, Sun, RefreshCw, User } from 'lucide-react';
import { getUserLocation, requestLocationPermission, saveUserLocation, Location } from '@/utils/locationUtils';
import { Crop } from '@/utils/types/cropTypes';
import { toast } from 'sonner';
import CropCard from '@/components/CropCard';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import BottomNavigation from '@/components/BottomNavigation';
import Header from '@/components/Header';

interface Notification {
  id: number;
  message: string;
  timestamp: string;
  read: boolean;
}

const Dashboard: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [weatherInfo, setWeatherInfo] = useState<{ temp: number; condition: string; icon: string }>({ 
    temp: 0, 
    condition: '', 
    icon: '' 
  });
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const { userCrops } = useGarden();
  const [cropDetails, setCropDetails] = useState<Crop[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

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

  // Fetch crop details for the user's garden crops
  useEffect(() => {
    const fetchCropDetails = async () => {
      try {
        const cropDetailsPromises = userCrops.map(async (cropName) => {
          const response = await fetch(`http://127.0.0.1:5000/crop/${cropName}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch details for ${cropName}`);
          }
          return response.json();
        });

        const crops = await Promise.all(cropDetailsPromises);
        setCropDetails(crops);
      } catch (error) {
        console.error('Error fetching crop details:', error);
        toast.error('Failed to load crop details. Please try again.');
      }
    };

    if (userCrops.length > 0) {
      fetchCropDetails();
    }
  }, [userCrops]);

  // Fetch weather data from the backend
  const fetchWeatherData = async (location: string) => {
    try {
      const response = await fetch('http://127.0.0.1:5000/weather', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ location }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch weather data');
      }

      const data = await response.json();
      setWeatherInfo({
        temp: data.temp,
        condition: data.condition,
        icon: data.icon, // Weather icon code
      });
    } catch (error) {
      console.error('Error fetching weather data:', error);
      toast.error('Failed to fetch weather data. Using default weather info.');
    }
  };

  // Function to refresh the user's location
  const refreshLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const location = await requestLocationPermission();
      setUserLocation(location);

      // Fetch weather data for the user's location
      if (location.city) {
        fetchWeatherData(location.city);
      }
    } catch (error) {
      console.error('[Dashboard] Error refreshing location:', error);
      toast.error('Failed to refresh location. Using cached location.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  useEffect(() => {
    const loadUserLocation = async () => {
      setIsLoadingLocation(true);
      try {
        const location = await requestLocationPermission();
        setUserLocation(location);

        // Fetch weather data for the user's location
        if (location.city) {
          fetchWeatherData(location.city);
        }
      } catch (error) {
        console.error('[Dashboard] Error getting location:', error);
        const fallbackLocation = {
          latitude: 0,
          longitude: 0,
          city: 'Kochi',
          state: 'Kerala',
          country: 'India',
        };
        saveUserLocation(fallbackLocation);
        setUserLocation(fallbackLocation);
        toast.info('Using default location (Kochi). Some features may be limited.');

        // Fetch weather data for the fallback location
        fetchWeatherData(fallbackLocation.city);
      } finally {
        setIsLoadingLocation(false);
      }
    };

    loadUserLocation();
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  const scheduleNotification = () => {
    toast.info('Notification scheduled', {
      description: 'You will be notified about watering times',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        title="PocketFarm" 
        notifications={notifications}
      />
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">Hello, {user?.name || 'Gardener'}</h2>
            {userLocation ? (
              <div>
                <p className="text-muted-foreground flex items-center mt-1">
                  <MapPin className="h-4 w-4 mr-1" />
                  {userLocation.city || 'Your Location'}{' '}
                  {userLocation.city && (
                    <span className="text-xs ml-1">
                      ({userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)})
                    </span>
                  )}
                </p>
                <Button
                  variant="link"
                  className="text-muted-foreground flex items-center p-0 h-auto mt-1"
                  onClick={refreshLocation}
                  disabled={isLoadingLocation}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {isLoadingLocation ? 'Updating...' : 'Refresh location'}
                </Button>
              </div>
            ) : (
              <p>Loading location...</p>
            )}
          </div>
          <Card className="w-auto">
            <CardContent className="p-3 flex items-center gap-2">
              {weatherInfo.condition.includes('Rain') ? (
                <CloudRain className="h-5 w-5 text-blue-500" />
              ) : (
                <Sun className="h-5 w-5 text-yellow-500" />
              )}
              <div>
                <p className="text-sm font-medium">{weatherInfo.temp}°C</p>
                <p className="text-xs text-muted-foreground">{weatherInfo.condition}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/recommendations">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="bg-muted rounded-full p-3 mb-3">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium">Find Crops</h3>
                <p className="text-sm text-muted-foreground mt-1">Get personalized crop recommendations</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/nursery-finder">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="bg-muted rounded-full p-3 mb-3">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-medium">Nursery Finder</h3>
                <p className="text-sm text-muted-foreground mt-1">Find nearby nurseries and shops</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* My Garden */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">My Garden</h2>
            <Link to="/user-crops">
              <Button variant="link" className="text-primary p-0 h-auto">
                View all crops <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          {cropDetails.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {cropDetails.slice(0, 4).map((crop) => (
                <CropCard
                  key={crop.id || crop.name}
                  crop={crop} // Pass the full crop details
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="mb-4">You haven't added any crops to your garden yet</p>
                <Link to="/recommendations">
                  <Button>
                    Find crops to grow
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick access to crop library */}
        <Link to="/crop-library">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <h3 className="font-medium">Crop Library</h3>
                <p className="text-sm text-muted-foreground">Search and browse all available crops</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Dashboard;