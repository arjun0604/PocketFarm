import React, { useEffect, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Search, MapPin, Droplets, User, Phone, Mail, MapPinIcon, History, Trophy, AlertTriangle } from 'lucide-react';
import { getUserLocation } from '@/utils/locationUtils';
import { toast } from 'sonner';
import { useGarden } from '@/context/GardenContext';
import BottomNavigation from '@/components/BottomNavigation';
import { Crop } from '@/utils/types/cropTypes';
import axios from 'axios';
import { format } from 'date-fns';
import Header from '@/components/Header';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useNavigationHistory } from '@/utils/useNavigationHistory';

interface CompletedCrop extends Crop {
  completedDate: string;
}

const UserProfile: React.FC = () => {
  const { user, isAuthenticated, updateUserProfile, logout, deleteAccount } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const { userCrops } = useGarden();
  const [cropDetails, setCropDetails] = useState<Crop[]>([]);
  const [completedCrops, setCompletedCrops] = useState<CompletedCrop[]>([]);
  const location = getUserLocation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { goBack } = useNavigationHistory();
  
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    const fetchCropDetails = async () => {
      try {
        const cropDetailsPromises = userCrops.map(async (cropName) => {
          const response = await axios.get(`http://127.0.0.1:5000/crop/${encodeURIComponent(cropName)}`);
          return response.data;
        });

        const crops = await Promise.all(cropDetailsPromises);
        setCropDetails(crops);

        // Check for completed crops
        const completedCropsPromises = crops.map(async (crop) => {
          try {
            // Get all schedules for the user
            const scheduleResponse = await axios.get(`http://127.0.0.1:5000/user_schedule/${user?.id}`);
            const schedules = scheduleResponse.data;
            
            // Find the schedule for this crop
            const schedule = schedules.find((s: any) => s.name === crop.name);
            
            if (schedule && schedule.last_watered) {
              const lastWateredDate = new Date(schedule.last_watered);
              // Use a default growing time of 60 days if recommended_info is not available
              const growingTime = crop.recommended_info?.['Avg Area'] ? crop.recommended_info['Avg Area'] * 7 : 60;
              const completionDate = new Date(lastWateredDate.getTime() + growingTime * 24 * 60 * 60 * 1000);
              
              if (completionDate < new Date()) {
                return {
                  ...crop,
                  completedDate: completionDate.toISOString()
                };
              }
            }
            return null;
          } catch (error) {
            console.error(`Error checking completion for ${crop.name}:`, error);
            return null;
          }
        });

        const completed = (await Promise.all(completedCropsPromises)).filter((crop): crop is CompletedCrop => crop !== null);
        setCompletedCrops(completed);

        // Show celebration message for newly completed crops
        const newCompletedCrops = completed.filter(crop => {
          const completionDate = new Date(crop.completedDate);
          const oneDayAgo = new Date();
          oneDayAgo.setDate(oneDayAgo.getDate() - 1);
          return completionDate > oneDayAgo;
        });

        if (newCompletedCrops.length > 0) {
          toast.success(
            `🎉 Congratulations! Your ${newCompletedCrops.map(crop => crop.name).join(', ')} ${newCompletedCrops.length === 1 ? 'has' : 'have'} finished growing!`,
            {
              duration: 5000,
            }
          );
        }
      } catch (error) {
        console.error('Error fetching crop details:', error);
        toast.error('Failed to load crop details. Please try again.');
      }
    };

    if (userCrops.length > 0) {
      fetchCropDetails();
    }
  }, [userCrops, user?.id]);
  
  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }
  
  const handleSaveProfile = () => {
    updateUserProfile({
      name,
      email,
      phone
    });
    
    setIsEditing(false);
    toast.success('Profile updated successfully');
  };
  
  const handleLogout = () => {
    logout();
    toast.info('You have been logged out');
  };
  
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      toast.success('Your account has been deleted successfully');
      navigate('/');
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-background pb-16">
      <Header 
        title="User Profile" 
        showBackButton
        onBackClick={goBack}
      />
      
      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-primary flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Profile
              </CardTitle>
              <CardDescription>
                Manage your personal information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input 
                      id="name" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input 
                      id="phone" 
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h3 className="font-medium">Name</h3>
                      <p>{user?.name || 'Not set'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h3 className="font-medium">Email</h3>
                      <p>{user?.email || 'Not set'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h3 className="font-medium">Phone</h3>
                      <p>{user?.phone || 'Not set'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPinIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h3 className="font-medium">Location</h3>
                      <p>
                        {location?.city ? (
                          `${location.city}, ${location.state}, ${location.country}`
                        ) : (
                          'Location not available'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              {isEditing ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveProfile}
                  >
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    onClick={handleLogout}
                  >
                    Logout
                  </Button>
                  <Button 
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Profile
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-primary flex items-center gap-2">
                <History className="h-5 w-5" />
                Crop History
              </CardTitle>
              <CardDescription>
                Your successfully harvested crops
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completedCrops.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completedCrops.map((crop) => (
                    <div key={crop.id} className="flex items-center gap-3 p-3 border rounded-md bg-green-50 dark:bg-green-950/30">
                      <div className="h-10 w-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                        <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-medium">{crop.name}</h3>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Harvested on {format(new Date(crop.completedDate), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="mb-2">No completed crops yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Your crops will appear here once they're ready to harvest</p>
                  <Button asChild>
                    <Link to="/crop-library">Browse Crops</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* My Garden */}
          <Card>
            <CardHeader>
              <CardTitle>My Garden</CardTitle>
              <CardDescription>Your current garden crops</CardDescription>
            </CardHeader>
            <CardContent>
              {cropDetails.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {cropDetails.map((crop) => (
                    <div key={crop.id} className="flex items-center space-x-2">
                      <img
                        src={crop.imageURL}
                        alt={crop.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div>
                        <h3 className="font-medium">{crop.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {crop.waterNeeds} water • {crop.sunlight} sun
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No crops in your garden yet</p>
              )}
            </CardContent>
            <CardFooter>
              <Link to="/my-garden" className="w-full">
                <Button className="w-full">View Full Garden</Button>
              </Link>
            </CardFooter>
          </Card>
          
          {/* Add Danger Zone Card */}
          <Card className="border-red-300">
            <CardHeader>
              <CardTitle className="text-xl text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Actions that cannot be undone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Deleting your account will remove all your personal information and data from our system. This action cannot be undone.
              </p>
              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    Delete My Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Account</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete your account? This action cannot be undone and all your personal data, crops, and watering schedules will be permanently removed.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <BottomNavigation />
    </div>
  );
};

export default UserProfile;