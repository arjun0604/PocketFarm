import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { AlertCircle, Cloud, Droplets, Thermometer, Wind, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface WeatherAlert {
  type: string;
  message: string;
  value: number | string;
}

interface WeatherData {
  weather_data: {
    main: {
      temp: number;
      humidity: number;
    };
    wind: {
      speed: number;
    };
    weather: Array<{
      main: string;
      description: string;
      icon: string;
    }>;
  };
  alerts: WeatherAlert[];
  user_id: number;
}

const WeatherAlert: React.FC = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Initialize socket connection
    const newSocket = io('http://127.0.0.1:5000');
    setSocket(newSocket);

    // Request notification permission
    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;

    // Listen for weather updates
    socket.on('weather_update', (data: WeatherData) => {
      // Only update if the data is for the current user
      if (data.user_id === Number(user.id)) {
        setWeatherData(data);
        setLastUpdate(new Date());
      }
    });

    // Listen for weather alerts
    socket.on('weather_alert', (alerts: WeatherAlert[]) => {
      alerts.forEach(alert => {
        // Show toast notification
        toast(alert.message, {
          icon: getAlertIcon(alert.type),
          duration: 5000,
        });

        // Show browser notification if permission is granted
        if (Notification.permission === 'granted') {
          new Notification('Weather Alert', {
            body: alert.message,
            icon: '/weather-icon.png',
          });
        }
      });
    });

    return () => {
      socket.off('weather_update');
      socket.off('weather_alert');
    };
  }, [socket, user]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'heavy_rain':
        return <Droplets className="h-5 w-5 text-blue-500" />;
      case 'strong_wind':
        return <Wind className="h-5 w-5 text-gray-500" />;
      case 'high_temperature':
      case 'low_temperature':
        return <Thermometer className="h-5 w-5 text-red-500" />;
      case 'high_humidity':
        return <Cloud className="h-5 w-5 text-gray-400" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const formatLastUpdate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return date.toLocaleDateString();
  };

  if (!weatherData || !user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Current Weather</h3>
          <img
            src={`http://openweathermap.org/img/wn/${weatherData.weather_data.weather[0].icon}@2x.png`}
            alt="Weather icon"
            className="w-12 h-12"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center">
            <Thermometer className="h-4 w-4 mr-1" />
            <span>{Math.round(weatherData.weather_data.main.temp)}°C</span>
          </div>
          <div className="flex items-center">
            <Droplets className="h-4 w-4 mr-1" />
            <span>{weatherData.weather_data.main.humidity}%</span>
          </div>
          <div className="flex items-center">
            <Wind className="h-4 w-4 mr-1" />
            <span>{weatherData.weather_data.wind.speed} m/s</span>
          </div>
          <div className="flex items-center">
            <Cloud className="h-4 w-4 mr-1" />
            <span>{weatherData.weather_data.weather[0].description}</span>
          </div>
        </div>
        {lastUpdate && (
          <div className="mt-2 text-sm text-gray-500 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span>Last updated: {formatLastUpdate(lastUpdate)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherAlert; 