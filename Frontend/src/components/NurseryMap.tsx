import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Globe, Star, Navigation, AlertCircle, RefreshCw } from 'lucide-react';
import { requestLocationPermission, saveUserLocation, clearStoredLocation } from '@/utils/locationUtils';
import { Nursery } from '@/utils/types/cropTypes';
import { fetchNearbyNurseries } from '@/utils/api/nurseryApi';
import { toast } from 'sonner';

interface NurseryMapProps {
  location?: { latitude: number, longitude: number } | null;
}

const NurseryMap: React.FC<NurseryMapProps> = ({ location }) => {
  const [nurseries, setNurseries] = useState<Nursery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'nursery' | 'store'>('all');
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(location || null);
  const [sortBy, setSortBy] = useState<'distance' | 'rating'>('distance');

  const fetchNurseries = useCallback(async (latitude: number, longitude: number) => {
    setIsLoading(true);
    try {
      toast.info('Finding nearby nurseries and garden supplies...');
      const nearbyNurseries = await fetchNearbyNurseries(latitude, longitude);

      // Process nurseries to ensure proper categorization
      const processedNurseries = nearbyNurseries.map(nursery => {
        const name = nursery.name.toLowerCase();
        const isNurseryByName = name.includes('nursery') || name.includes('garden') || name.includes('plant') || name.includes('farm');
        const nurseryType: 'nursery' | 'store' = isNurseryByName ? 'nursery' : 'store';

        return {
          ...nursery,
          type: nurseryType
        };
      });

      if (processedNurseries.length === 0) {
        toast.warning('No nearby nurseries found. Try expanding your search area.');
      } else {
        toast.success(`Found ${processedNurseries.length} plant nurseries and supply stores near you!`);
      }

      setNurseries(processedNurseries);
      console.log('Updated nurseries list:', processedNurseries);
    } catch (error) {
      console.error('Error fetching nurseries:', error);
      toast.error('Failed to load nearby nurseries');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshLocation = useCallback(async () => {
    setIsLoading(true);
    try {
      // Don't clear stored location, just update it
      const newLocation = await requestLocationPermission();
      console.log('New location obtained:', newLocation);

      setUserLocation({
        latitude: newLocation.latitude,
        longitude: newLocation.longitude
      });

      // Update the location without clearing the stored one
      saveUserLocation(newLocation);
      await fetchNurseries(newLocation.latitude, newLocation.longitude);

      toast.success(`Location updated to ${newLocation.city || 'your current location'}`);
    } catch (error) {
      console.error('Error updating location:', error);
      toast.error('Failed to update location');
    } finally {
      setIsLoading(false);
    }
  }, [fetchNurseries]);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        if (!location) {
          const newLocation = await requestLocationPermission();
          setUserLocation({
            latitude: newLocation.latitude,
            longitude: newLocation.longitude
          });
          saveUserLocation(newLocation);
          fetchNurseries(newLocation.latitude, newLocation.longitude);
        } else {
          fetchNurseries(location.latitude, location.longitude);
        }
      } catch (error) {
        console.error('Error getting location:', error);
        toast.error('Location access is required to find nearby nurseries');
        setIsLoading(false);
      }
    };

    fetchLocation();
  }, [location, fetchNurseries]);

  const filteredNurseries = filterType === 'all'
    ? nurseries
    : nurseries.filter(nursery => nursery.type === filterType);

  // Sort nurseries based on selected criteria
  const sortedNurseries = [...filteredNurseries].sort((a, b) => {
    if (sortBy === 'distance') {
      return a.distance - b.distance;
    } else {
      return b.rating - a.rating;
    }
  });

  const openDirections = (latitude: number, longitude: number) => {
    if (!userLocation) {
      toast.error('Please enable location access to get directions');
      return;
    }

    // Check if coordinates are valid numbers
    if (isNaN(latitude) || isNaN(longitude)) {
      toast.error('Invalid location coordinates');
      return;
    }

    // Create a more detailed Google Maps URL with origin and destination
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${latitude},${longitude}&travelmode=driving`;
    
    // Log the URL for debugging
    console.log('Opening directions URL:', url);
    console.log('Coordinates:', { latitude, longitude, userLocation });
    
    window.open(url, '_blank');
  };

  const FilterButton: React.FC<{ type: 'all' | 'nursery' | 'store', currentFilter: string, onClick: () => void }> = ({ type, currentFilter, onClick }) => (
    <Button
      variant={currentFilter === type ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
    >
      {type === 'all' ? 'All' : type === 'nursery' ? 'Nurseries' : 'Supplies'}
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-primary">Nearby Plant Nurseries & Supplies</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshLocation}
          className="flex items-center gap-1"
          disabled={isLoading}
          aria-label="Update Location"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Update Location
        </Button>
      </div>

      {userLocation && (
        <div className="bg-muted rounded-md p-3 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm">
              {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
            </span>
          </div>
          <div className="flex gap-2">
            <FilterButton type="all" currentFilter={filterType} onClick={() => setFilterType('all')} />
            <FilterButton type="nursery" currentFilter={filterType} onClick={() => setFilterType('nursery')} />
            <FilterButton type="store" currentFilter={filterType} onClick={() => setFilterType('store')} />
          </div>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Button
            variant={sortBy === 'distance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('distance')}
          >
            Distance
          </Button>
          <Button
            variant={sortBy === 'rating' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('rating')}
          >
            Rating
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p>Loading nearby nurseries...</p>
        </div>
      ) : !userLocation ? (
        <div className="py-12 text-center bg-muted rounded-lg">
          <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
          <p className="text-lg font-medium">Location access required</p>
          <p className="mb-4">We need your location to find nurseries near you</p>
          <Button
            onClick={refreshLocation}
          >
            Allow Location Access
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedNurseries.length > 0 ? (
            sortedNurseries.map((nursery) => (
              <Card key={nursery.id} className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-lg">{nursery.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={`px-2 py-0.5 text-xs font-medium ${
                          nursery.type === 'nursery' 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800' 
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                        }`}>
                          {nursery.type === 'nursery' ? 'Nursery' : 'Supplies'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>
                          {nursery.address_loading ? (
                            <span className="text-muted-foreground animate-pulse">Loading address...</span>
                          ) : (
                            nursery.address
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{nursery.distance} km away</span>
                        {nursery.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {nursery.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">{nursery.rating}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            console.log('Nursery coordinates:', { 
                              lat: nursery.lat || nursery.latitude, 
                              lon: nursery.lon || nursery.longitude 
                            });
                            openDirections(
                              nursery.lat || nursery.latitude, 
                              nursery.lon || nursery.longitude
                            );
                          }}
                        >
                          <Navigation className="h-3 w-3 mr-1" />
                          Get Directions
                        </Button>
                      </div>
                    </div>

                    {nursery.website && (
                      <Button variant="outline" size="sm" className="h-8 w-full" asChild>
                        <a href={`https://${nursery.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1">
                          <Globe className="h-3 w-3" />
                          Visit Website
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center">
              <p>No {filterType === 'all' ? '' : filterType} locations found nearby.</p>
              <Button
                variant="link"
                onClick={() => setFilterType('all')}
                className="text-primary"
              >
                Show all locations
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NurseryMap;