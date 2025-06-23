import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Crop } from "@/utils/types/cropTypes";
import CropCard from "./CropCard";
import { Search, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/context/GardenContext"; // Import useGarden

interface CropSearchProps {
  onRemoveFromGarden?: (cropName: string) => Promise<void>;
}

const INITIAL_CROPS = ["Tomato", "Lettuce", "Carrot", "Cauliflower", "Coriander", "Potato", "Garlic", "Onion"];

const CropSearch: React.FC<CropSearchProps> = ({ onRemoveFromGarden }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Crop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const { userCrops, addCropToGarden, removeCropFromGarden } = useGarden(); // Use the garden context

  useEffect(() => {
    fetchInitialCrops();
  }, []);

  const fetchInitialCrops = async () => {
    setIsLoading(true);
    try {
      const cropRequests = INITIAL_CROPS.map(async (cropName) => {
        const response = await fetch(`http://127.0.0.1:5000/crop/${encodeURIComponent(cropName)}`);
        if (response.ok) {
          return await response.json();
        }
        return null;
      });

      const crops = await Promise.all(cropRequests);
      const validCrops = crops.filter((crop) => crop !== null);

      setSearchResults(validCrops);
    } catch (error) {
      console.error("Error loading initial crops:", error);
      toast.error("Failed to load crops");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      fetchInitialCrops();
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(`http://127.0.0.1:5000/crop/${encodeURIComponent(searchQuery.trim())}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults([data]);
        toast.success(`Found ${data.name}`);
      } else {
        setSearchResults([]);
        toast.info("No crops found matching your search");
      }
    } catch (error) {
      console.error("Error searching for crops:", error);
      toast.error("Failed to search for crops");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    fetchInitialCrops();
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="text"
          placeholder="Search crops by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-24"
        />
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-12 top-0 h-full"
            onClick={clearSearch}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
        <Button
          type="submit"
          variant="default"
          size="icon"
          className="absolute right-0 top-0 h-full rounded-l-none"
          disabled={isSearching}
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="sr-only">Search</span>
        </Button>
      </form>

      {/* Crop Results */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          {searchQuery ? `Search Results for "${searchQuery}"` : "Recommended Crops"}
          {searchResults.length > 0 && <span className="text-sm font-normal text-muted-foreground ml-2">({searchResults.length} results)</span>}
        </h2>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : searchResults.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {searchResults.map((crop) => (
              <CropCard
                key={crop.id}
                crop={crop}
                onRemoveFromGarden={onRemoveFromGarden}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg mb-2">No crops found matching "{searchQuery}"</p>
            <Button variant="link" onClick={clearSearch} className="text-primary">
              Clear search
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CropSearch;