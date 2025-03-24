import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { requestLocationPermission, Location } from '@/utils/locationUtils';
import { toast } from 'sonner';
import BottomNavigation from '@/components/BottomNavigation';
import Header from '@/components/Header';
import NurseryMap from '@/components/NurseryMap';
import { useNavigationHistory } from '@/utils/useNavigationHistory';

const NurseryFinder: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { goBack } = useNavigationHistory();

  useEffect(() => {
    const loadLocation = async () => {
      try {
        const location = await requestLocationPermission();
        setUserLocation(location);
        toast.info('Finding plant nurseries and garden supplies near you...');
      } catch (error) {
        console.error('[NurseryFinder] Error getting location:', error);
        toast.error('Failed to get your location. Please enable location services or set a location manually.');
      } finally {
        setIsLoading(false);
      }
    };
    loadLocation();
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header 
        title="Plant Nurseries & Garden Centers" 
        showBackButton 
        onBackClick={goBack}
      />

      <main className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-12">
            <p>Loading nursery map...</p>
          </div>
        ) : (
          <NurseryMap location={userLocation} />
        )}
      </main>

      <BottomNavigation />
    </div>
  );
};

export default NurseryFinder;