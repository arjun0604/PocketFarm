import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Home, Search, MapPin, Droplets } from 'lucide-react';
import CropSearch from '@/components/CropSearch';
import { useGarden } from '@/context/GardenContext'; // Import useGarden
import BottomNavigation from '@/components/BottomNavigation';
import Header from '@/components/Header';
import { useNavigationHistory } from '@/utils/useNavigationHistory';

const CropLibrary: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { userCrops, removeCropFromGarden } = useGarden(); // Use the garden context
  const { goBack } = useNavigationHistory();

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header 
        title="Crop Library" 
        showBackButton 
        onBackClick={goBack}
      />
      
      <main className="container mx-auto px-4 py-6">
        {/* Pass the onRemoveFromGarden prop to CropSearch */}
        <CropSearch onRemoveFromGarden={removeCropFromGarden} />
      </main>
      
      {/* Replace the existing nav with BottomNavigation */}
      <BottomNavigation />
    </div>
  );
};

export default CropLibrary;