import requests
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get the API key from the environment variable
API_KEY = os.getenv("OPENWEATHERMAP_API_KEY")
if not API_KEY:
    raise ValueError("OpenWeatherMap API key is missing. Set OPENWEATHERMAP_API_KEY in .env file.")

# Test the API key by making a request to the Current Weather Data API
def test_api_key():
    # Example location (Kochi, India)
    location = "Kochi"
    url = f"http://api.openweathermap.org/data/2.5/weather?q={location}&appid={API_KEY}&units=metric"
    
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an error for bad responses (4xx or 5xx)
        data = response.json()
        
        # Check if the API key is valid
        if data.get("cod") == 200:
            print("API key is valid! Response data:")
            print(data)
        else:
            print(f"Error: {data.get('message')}")
    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data: {e}")

# Run the test
test_api_key()
