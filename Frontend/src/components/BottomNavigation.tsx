import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, MapPin, Droplets, User } from 'lucide-react';

const BottomNavigation: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-primary' : 'text-muted-foreground';
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-[100] shadow-lg">
      <div className="container mx-auto flex items-center justify-around py-2">
        <Link to="/dashboard" className={`flex flex-col items-center p-2 ${isActive('/dashboard')}`}>
          <Home className="h-5 w-5" />
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link to="/recommendations" className={`flex flex-col items-center p-2 ${isActive('/recommendations')}`}>
          <Search className="h-5 w-5" />
          <span className="text-xs mt-1">Find Crops</span>
        </Link>
        <Link to="/my-garden" className={`flex flex-col items-center p-2 ${isActive('/my-garden')}`}>
          <User className="h-5 w-5" />
          <span className="text-xs mt-1">My Garden</span>
        </Link>
        <Link to="/nursery-finder" className={`flex flex-col items-center p-2 ${isActive('/nursery-finder')}`}>
          <MapPin className="h-5 w-5" />
          <span className="text-xs mt-1">Nurseries</span>
        </Link>
        <Link to="/crop-library" className={`flex flex-col items-center p-2 ${isActive('/crop-library')}`}>
          <Droplets className="h-5 w-5" />
          <span className="text-xs mt-1">Crops</span>
        </Link>
      </div>
    </nav>
  );
};

export default BottomNavigation; 