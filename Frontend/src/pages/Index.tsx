import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthForm from '@/components/AuthForm';
import { Leaf } from 'lucide-react';

const Index = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md mb-8 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-primary rounded-full mb-4">
          <Leaf className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary">PocketFarm</h1>
        <p className="text-muted-foreground mt-2">Your personal pocket-sized farm assistant</p>
      </div>

      <AuthForm />
      
      <div className="mt-12 text-center max-w-md">
        <h2 className="text-lg font-semibold text-primary mb-2">Grow with confidence</h2>
        <p className="text-sm text-muted-foreground mb-4">
          PocketFarm helps you find the perfect crops for your location and conditions, 
          tracks your garden's progress, and sends timely reminders for watering and care.
        </p>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <div className="bg-muted rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
              <span className="text-primary text-xl">🌱</span>
            </div>
            <p className="text-xs font-medium">Personalized crop suggestions</p>
          </div>
          <div className="text-center">
            <div className="bg-muted rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
              <span className="text-primary text-xl">⛅</span>
            </div>
            <p className="text-xs font-medium">Weather alerts</p>
          </div>
          <div className="text-center">
            <div className="bg-muted rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
              <span className="text-primary text-xl">🌿</span>
            </div>
            <p className="text-xs font-medium">Nearby nursery finder</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
