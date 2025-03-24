import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { GardenProvider } from "@/context/GardenContext"; // Import the GardenProvider
import { ThemeProvider } from "@/components/ThemeProvider"; // Import ThemeProvider
import { ScrollToTop } from "@/utils/routeUtils"; // Import ScrollToTop
import WeatherAlert from "@/components/WeatherAlert";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Recommendations from "./pages/Recommendations";
import NurseryFinder from "./pages/NurseryFinder";
import CropLibrary from "./pages/CropLibrary";
import UserProfile from "./pages/UserProfile";
import NotFound from "./pages/NotFound";
import UserCrops from "./pages/UserCrops"; // Import the new UserCrops component
import WateringSchedule from "./pages/WateringSchedule";
import Users from './pages/Users';
import VerifyEmail from './pages/VerifyEmail';
import NeedVerification from './pages/NeedVerification';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="pocketfarm-theme">
      <AuthProvider>
        <GardenProvider> {/* Wrap the app with GardenProvider */}
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/nursery-finder" element={<NurseryFinder />} />
                <Route path="/crop-library" element={<CropLibrary />} />
                <Route path="/profile" element={<UserProfile />} />
                <Route path="/user-crops" element={<UserCrops />} />
                <Route path="/my-garden" element={<UserCrops />} />
                <Route path="/watering-schedule" element={<WateringSchedule />} />
                <Route path="/users" element={<Users />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/need-verification" element={<NeedVerification />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            <WeatherAlert />
          </TooltipProvider>
        </GardenProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;