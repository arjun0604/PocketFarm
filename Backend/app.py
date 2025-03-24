from flask import Flask, request, jsonify, g
import requests
import sqlite3
from crops import recommend_crops
from flask_socketio import SocketIO, join_room, emit
import time
import threading
import os
from functools import lru_cache
from flask_cors import CORS
from dotenv import load_dotenv
import bcrypt
from datetime import datetime, timedelta
import math
import logging
import traceback
import random
import sys
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import yagmail

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Simple CORS configuration
app.config['SECRET_KEY'] = 'secret!'
app.config['CORS_HEADERS'] = 'Content-Type'
CORS(app, supports_credentials=True, origins=["https://localhost:8080", "http://localhost:8080", 
                          "https://127.0.0.1:8080", "http://127.0.0.1:8080"])

# Configure Socket.IO with proper CORS settings
socketio = SocketIO(app, 
                   cors_allowed_origins=["https://localhost:8080", "http://localhost:8080", 
                                       "https://127.0.0.1:8080", "http://127.0.0.1:8080"],
                   logger=True,
                   engineio_logger=True,
                   ping_timeout=60,
                   ping_interval=25,
                   async_mode='threading',
                   always_connect=True,
                   cors_credentials=True,
                   websocket_ping_interval=25,
                   manage_session=False)

# Add CORS headers to all responses
@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', 'https://localhost:8080')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Handle preflight OPTIONS requests
@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    return app.make_default_options_response()

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")
    return True

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")
    return True

@socketio.on('join')
def on_join(data):
    """Handle socket room joining."""
    user_id = data.get('user_id')
    if user_id:
        room = f"user_{user_id}"
        join_room(room)
        logger.info(f"User {user_id} joined room: {room}")

# Use environment variable for API key
API_KEY = os.getenv("OPENWEATHERMAP_API_KEY")
if not API_KEY:
    logger.warning("OpenWeatherMap API key is missing. Set OPENWEATHERMAP_API_KEY in .env file.")

# Add these constants after the API_KEY definition
WEATHER_ALERT_THRESHOLDS = {
    'heavy_rain': {
        'condition': 'Rain',
        'threshold': 25,  # Increased from 10 to 25 mm/hour for more significant rain
        'message': 'Heavy rain alert! Consider protecting your plants.',
        'cooldown_hours': 24  # Only alert once per day for heavy rain
    },
    'strong_wind': {
        'condition': 'Wind',
        'threshold': 50,  # Increased from 30 to 50 km/h for more significant wind
        'message': 'Strong winds detected! Secure your plants.',
        'cooldown_hours': 12  # Only alert once every 12 hours for strong winds
    },
    'high_temperature': {
        'condition': 'Temperature',
        'threshold': 38,  # Increased from 35 to 38°C for more significant heat
        'message': 'High temperature alert! Ensure proper watering.',
        'cooldown_hours': 12  # Only alert once every 12 hours for high temperature
    },
    'low_temperature': {
        'condition': 'Temperature',
        'threshold': 2,  # Increased from 5 to 2°C for more significant cold
        'message': 'Low temperature alert! Protect sensitive plants.',
        'cooldown_hours': 12  # Only alert once every 12 hours for low temperature
    },
    'high_humidity': {
        'condition': 'Humidity',
        'threshold': 90,  # Increased from 85 to 90% for more significant humidity
        'message': 'High humidity alert! Watch for fungal diseases.',
        'cooldown_hours': 24  # Only alert once per day for high humidity
    }
}

def get_db():
    """Get a database connection with proper timeout and error handling."""
    try:
        conn = sqlite3.connect('PocketFarm.db', timeout=30)  # Increased timeout to 30 seconds
        conn.row_factory = sqlite3.Row
        # Enable WAL mode for better concurrency
        conn.execute('PRAGMA journal_mode=WAL')
        # Set busy timeout
        conn.execute('PRAGMA busy_timeout=30000')  # 30 seconds
        return conn
    except sqlite3.Error as e:
        print(f"Database connection error: {str(e)}")
        raise

@app.route('/crop_schedule', methods=['GET'])
def get_crop_schedule():
    try:
        conn = get_db()
        cursor = conn.cursor()

        # Fetch all crop schedules
        cursor.execute("SELECT * FROM crop_schedule")
        schedules = cursor.fetchall()

        conn.close()

        # Format the response
        schedule_list = [dict(schedule) for schedule in schedules]
        return jsonify(schedule_list), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/user_schedule', methods=['POST'])
def create_user_schedule():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        user_id = data.get('user_id')
        crop_name = data.get('crop_name')

        if not user_id or not crop_name:
            return jsonify({'error': 'Missing required fields: user_id or crop_name'}), 400

        conn = get_db()
        cursor = conn.cursor()

        try:
            # Start transaction
            cursor.execute('BEGIN TRANSACTION')

            # First check if the crop exists in the crops table
            cursor.execute("SELECT id FROM crops WHERE name = ?", (crop_name,))
            crop = cursor.fetchone()
            if not crop:
                cursor.execute('ROLLBACK')
                conn.close()
                return jsonify({'error': f'Crop "{crop_name}" not found in the database'}), 404

            # Check if the user exists
            cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            user = cursor.fetchone()
            if not user:
                cursor.execute('ROLLBACK')
                conn.close()
                return jsonify({'error': f'User with id "{user_id}" not found'}), 404

            # Check if schedule already exists
            cursor.execute('''
                SELECT ws.id FROM watering_schedules ws
                JOIN crops c ON ws.crop_id = c.id
                WHERE ws.user_id = ? AND c.name = ?
            ''', (user_id, crop_name))
            existing_schedule = cursor.fetchone()
            if existing_schedule:
                cursor.execute('COMMIT')
                conn.close()
                return jsonify({'message': 'Schedule already exists for this crop'}), 200

            # Get the schedule details from crop_schedule
            cursor.execute('''
                SELECT growing_time, watering_frequency, fertilization_schedule
                FROM crop_schedule
                WHERE crop_name = ?
            ''', (crop_name,))
            schedule_data = cursor.fetchone()
            
            if not schedule_data:
                cursor.execute('ROLLBACK')
                conn.close()
                return jsonify({'error': f'No schedule data found for crop "{crop_name}"'}), 404

            growing_time, watering_frequency, fertilization_schedule = schedule_data

            # Calculate initial watering dates
            current_date = datetime.now().strftime('%Y-%m-%d')
            next_watering = (datetime.now() + timedelta(days=watering_frequency)).strftime('%Y-%m-%d')

            # Insert the user's watering schedule with current date for last_watered
            cursor.execute('''
                INSERT INTO watering_schedules 
                (user_id, crop_id, watering_frequency, fertilization_schedule, last_watered, next_watering)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, crop[0], watering_frequency, fertilization_schedule, current_date, next_watering))

            # Commit transaction
            cursor.execute('COMMIT')
            conn.close()
            return jsonify({'message': 'User schedule created successfully!'}), 200

        except sqlite3.Error as e:
            # Rollback transaction on error
            cursor.execute('ROLLBACK')
            conn.close()
            print(f"Database error in create_user_schedule: {str(e)}")
            return jsonify({'error': f'Database error occurred: {str(e)}'}), 500
        except Exception as e:
            # Rollback transaction on error
            cursor.execute('ROLLBACK')
            conn.close()
            print(f"Error in create_user_schedule: {str(e)}")
            return jsonify({'error': str(e)}), 500

    except Exception as e:
        print(f"Error in create_user_schedule: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/user_schedule/<int:user_id>/<crop_name>', methods=['DELETE'])
def delete_user_schedule(user_id, crop_name):
    try:
        conn = get_db()
        cursor = conn.cursor()

        # First check if the schedule exists
        cursor.execute('''
            SELECT ws.id FROM watering_schedules ws
            JOIN crops c ON ws.crop_id = c.id
            WHERE ws.user_id = ? AND c.name = ?
        ''', (user_id, crop_name))
        schedule = cursor.fetchone()

        if not schedule:
            conn.close()
            return jsonify({'message': 'No schedule found for this crop'}), 200

        # Delete the user's watering schedule
        cursor.execute('''
            DELETE FROM watering_schedules
            WHERE user_id = ? AND crop_id IN (
                SELECT id FROM crops WHERE name = ?
            )
        ''', (user_id, crop_name))
        conn.commit()

        conn.close()
        return jsonify({'message': 'User schedule deleted successfully!'}), 200
    except Exception as e:
        print(f"Error deleting user schedule: {str(e)}")  # Add logging
        return jsonify({'error': str(e)}), 500

def calculate_next_dates(last_date, frequency):
    if not last_date:
        return datetime.now().strftime('%Y-%m-%d')
    last_date = datetime.strptime(last_date, '%Y-%m-%d')
    next_date = last_date + timedelta(days=frequency)
    return next_date.strftime('%Y-%m-%d')

@app.route('/update_watering', methods=['POST'])
def update_watering():
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        crop_name = data.get('crop_name')
        water_status = data.get('water_status')  # New parameter to toggle state
        
        if not user_id or not crop_name:
            return jsonify({'error': 'Missing required fields'}), 400

        conn = get_db()
        cursor = conn.cursor()

        # Get the current schedule
        cursor.execute('''
            SELECT ws.id, ws.last_watered, ws.watering_frequency
            FROM watering_schedules ws
            JOIN crops c ON ws.crop_id = c.id
            WHERE ws.user_id = ? AND c.name = ?
        ''', (user_id, crop_name))
        schedule = cursor.fetchone()

        if not schedule:
            conn.close()
            return jsonify({'error': 'Watering schedule not found'}), 404

        schedule_id, last_watered, watering_frequency = schedule

        # If water_status is True, mark as watered and update next_watering
        if water_status:
            # Calculate the next watering date
            current_date = datetime.now().strftime('%Y-%m-%d')
            next_watering = calculate_next_dates(current_date, watering_frequency)
            
            # Update the watering schedule with today's date and mark as watered
            cursor.execute('''
                UPDATE watering_schedules
                SET last_watered = ?, next_watering = ?, water_status = 1
                WHERE id = ?
            ''', (current_date, next_watering, schedule_id))
            
            # Create a notification for the user
            notification_message = f"Great job! You've watered your {crop_name}. Next watering is scheduled for {next_watering}."
            create_notification(user_id, notification_message)
            
            result_message = f"Watering schedule updated successfully! Next watering: {next_watering}"
        else:
            # If water_status is False, mark as not watered
            cursor.execute('''
                UPDATE watering_schedules
                SET water_status = 0
                WHERE id = ?
            ''', (schedule_id,))
            
            result_message = "Watering status updated."
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': result_message}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_weather_data(location):
    """Fetch weather data from OpenWeatherMap API with fallback for unavailable locations."""
    if not API_KEY:
        return None

    # Step 1: Try the user-provided location
    url = f"http://api.openweathermap.org/data/2.5/weather?q={location}&appid={API_KEY}&units=metric"
    
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an error for bad responses (e.g., 404)
        return response.json()
    except requests.exceptions.HTTPError as e:
        if response.status_code == 404:
            print(f"Location '{location}' not found. Falling back to a broader location.")
            # Step 2: Fallback to a broader location (e.g., Kochi)
            fallback_location = "Kochi"  # You can adjust this based on your app's context
            url = f"http://api.openweathermap.org/data/2.5/weather?q={fallback_location}&appid={API_KEY}&units=metric"
            try:
                response = requests.get(url)
                response.raise_for_status()
                print(f"Using weather data for fallback location: {fallback_location}")
                return response.json()
            except requests.exceptions.RequestException as e2:
                print(f"Error fetching weather data for fallback location: {e2}")
                return None
        else:
            print(f"Error fetching weather data: {e}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data: {e}")
        return None

def get_weather_alerts(location):
    """Fetch weather data using OpenWeatherMap Current Weather Data API (free plan)."""
    url = f"http://api.openweathermap.org/data/2.5/weather?lat={location['lat']}&lon={location['lon']}&appid={API_KEY}&units=metric"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        return data  # Return the current weather data
    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather data: {e}")
        return None

def check_weather_alerts(weather_data):
    """Check weather conditions against thresholds and return alerts."""
    alerts = []
    
    # Extract weather data
    temp = weather_data['main']['temp']
    humidity = weather_data['main']['humidity']
    wind_speed = weather_data['wind']['speed']
    weather_condition = weather_data['weather'][0]['main']
    
    # Get current timestamp
    current_time = datetime.now()
    
    # Check each threshold
    for alert_type, threshold_data in WEATHER_ALERT_THRESHOLDS.items():
        # Check if enough time has passed since last alert
        conn = get_db()
        cursor = conn.cursor()
        
        # First check if user has weather alerts enabled
        cursor.execute("""
            SELECT weather_alerts FROM notification_preferences 
            WHERE user_id = ?
        """, (user_id,))
        preferences = cursor.fetchone()
        
        if not preferences or not preferences[0]:
            conn.close()
            continue
            
        # Check if enough time has passed since last alert
        cursor.execute("""
            SELECT timestamp FROM notifications 
            WHERE message LIKE ? AND user_id = ?
            ORDER BY timestamp DESC LIMIT 1
        """, (f"%{threshold_data['message']}%", user_id))
        last_alert = cursor.fetchone()
        conn.close()
        
        # If there's a last alert, check if enough time has passed
        if last_alert:
            last_alert_time = datetime.strptime(last_alert[0], '%Y-%m-%d %H:%M:%S')
            hours_since_last_alert = (current_time - last_alert_time).total_seconds() / 3600
            if hours_since_last_alert < threshold_data['cooldown_hours']:
                continue  # Skip this alert if within cooldown period
        
        # Validate weather conditions before creating alerts
        if threshold_data['condition'] == 'Temperature':
            if temp >= threshold_data['threshold']:
                alerts.append({
                    'type': 'high_temperature',
                    'message': threshold_data['message'],
                    'value': temp
                })
            elif temp <= threshold_data['threshold']:
                alerts.append({
                    'type': 'low_temperature',
                    'message': threshold_data['message'],
                    'value': temp
                })
        elif threshold_data['condition'] == 'Humidity':
            if humidity >= threshold_data['threshold']:
                alerts.append({
                    'type': 'high_humidity',
                    'message': threshold_data['message'],
                    'value': humidity
                })
        elif threshold_data['condition'] == 'Wind':
            if wind_speed >= threshold_data['threshold']:
                alerts.append({
                    'type': 'strong_wind',
                    'message': threshold_data['message'],
                    'value': wind_speed
                })
        elif threshold_data['condition'] == 'Rain':
            # For rain, we need to check if it's actually raining
            if weather_condition == 'Rain':
                alerts.append({
                    'type': 'heavy_rain',
                    'message': threshold_data['message'],
                    'value': weather_condition
                })
    
    return alerts

def fetch_weather_alerts():
    """Background thread to fetch and emit weather data and alerts."""
    if not API_KEY:
        print("OpenWeatherMap API key is missing.")
        return

    while True:
        try:
            # Get all users from the database
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.id, u.location_latitude, u.location_longitude, np.weather_alerts
                FROM users u
                LEFT JOIN notification_preferences np ON u.id = np.user_id
                WHERE u.location_latitude IS NOT NULL AND u.location_longitude IS NOT NULL
            """)
            users = cursor.fetchall()
            conn.close()

            for user in users:
                user_id, lat, lon, weather_alerts_enabled = user
                
                # Skip if weather alerts are disabled
                if not weather_alerts_enabled:
                    continue
                    
                location = {'lat': lat, 'lon': lon}
                
                weather_data = get_weather_alerts(location)
                if weather_data:
                    # Check for weather alerts
                    alerts = check_weather_alerts(weather_data)
                    
                    # Emit both weather data and alerts to specific user
                    socketio.emit('weather_update', {
                        'weather_data': weather_data,
                        'alerts': alerts,
                        'user_id': user_id
                    }, room=f'user_{user_id}')
                    
                    # If there are alerts, create notifications and emit them
                    if alerts:
                        # Create notifications in the database
                        conn = get_db()
                        cursor = conn.cursor()
                        for alert in alerts:
                            cursor.execute("""
                                INSERT INTO notifications (user_id, message)
                                VALUES (?, ?)
                            """, (user_id, alert['message']))
                        conn.commit()
                        conn.close()
                        
                        # Emit alerts for immediate notification
                        socketio.emit('weather_alert', alerts, room=f'user_{user_id}')
            
            time.sleep(1800)  # Check every 30 minutes
        except Exception as e:
            print(f"Error in fetch_weather_alerts: {str(e)}")
            time.sleep(300)  # Wait 5 minutes before retrying on error

@lru_cache(maxsize=1000)
def cached_geocode(latitude, longitude, service="openweathermap"):
    """
    Fetch geocode data from OpenWeatherMap (primary) or Nominatim (fallback).
    Caches results to avoid hitting API rate limits.
    """
    headers = {"User-Agent": "PocketFarm/1.0 (contact: arjunsanthosh11b2@gmail.com)"}

    if service == "openweathermap" and API_KEY:
        # Use OpenWeatherMap Geocoding API
        url = f"http://api.openweathermap.org/geo/1.0/reverse?lat={latitude}&lon={longitude}&limit=1&appid={API_KEY}"
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            if data and len(data) > 0:
                return {"source": "openweathermap", "data": data[0]}
        except requests.exceptions.RequestException as e:
            print(f"OpenWeatherMap geocoding failed: {e}")

    # Fallback to Nominatim if OpenWeatherMap fails or no API key
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={latitude}&lon={longitude}&zoom=18&addressdetails=1"
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return {"source": "nominatim", "data": response.json()}
    except requests.exceptions.RequestException as e:
        raise Exception(f"Geocoding failed: {e}")

@app.route('/geocode', methods=['POST'])
def geocode():
    """
    Reverse geocode latitude and longitude to get city, state, and country.
    Uses OpenWeatherMap as primary service with Nominatim fallback.
    """
    try:
        data = request.get_json()
        latitude = data['latitude']
        longitude = data['longitude']

        # Fetch geocode data (cached)
        result = cached_geocode(latitude, longitude, service="openweathermap")
        source = result["source"]
        geocode_data = result["data"]

        if source == "openweathermap":
            # Extract details from OpenWeatherMap response
            city = geocode_data.get('name', 'Unknown City')
            state = geocode_data.get('state', 'Unknown State')
            country = geocode_data.get('country', 'Unknown Country')
        else:
            # Extract details from Nominatim response
            address = geocode_data.get('address', {})
            city = address.get('city') or address.get('town') or address.get('village') or 'Unknown City'
            state = address.get('state') or 'Unknown State'
            country = address.get('country') or 'Unknown Country'

        # Log the result for debugging
        print(f"Geocoded {latitude}, {longitude} using {source}: {city}, {state}, {country}")

        return jsonify({
            'city': city,
            'state': state,
            'country': country,
        })
    except KeyError as e:
        return jsonify({'error': f"Missing required field: {str(e)}"}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/response', methods=['POST'])
def handle_response():
    """Handle user response for watering."""
    try:
        data = request.get_json()
        device_token = data['device_token']
        response = data['response']  # 'yes' or 'no'

        # Connect to the database
        conn = sqlite3.connect('PocketFarm.db')
        cursor = conn.cursor()

        current_date = time.strftime('%Y-%m-%d')

        if response.lower() == 'yes':
            # Update last watered date and set next watering date (e.g., 7 days later)
            next_watering_date = time.strftime('%Y-%m-%d', time.localtime(time.time() + 7 * 86400))  # 7 days later
            cursor.execute("UPDATE users SET last_watered_date=?, next_watering_date=? WHERE device_token=?", 
                          (current_date, next_watering_date, device_token))
        elif response.lower() == 'no':
            # Set the next watering date to the current date
            cursor.execute("UPDATE users SET next_watering_date=? WHERE device_token=?", 
                          (current_date, device_token))

        conn.commit()
        conn.close()

        return jsonify({'message': 'Response recorded successfully!'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    """Predict crops based on environmental factors."""
    try:
        data = request.get_json()
        
        # Extract features from the incoming JSON data
        sunlight = data['sunlight']
        water_needs = data['water_needs']
        avg_temp = data['avg_temp']
        avg_humidity = data['avg_humidity']
        avg_area = data['avg_area']
        current_month = data['current_month']
        
        # Ensure water_needs and sunlight match the case in crop.csv
        water_needs = water_needs.capitalize()  # Convert to capitalized form (e.g., 'medium' -> 'Medium')
        sunlight = sunlight.capitalize()  # Convert to capitalized form (e.g., 'full' -> 'Full')
        
        # Call the recommend_crops function from crops.py
        result = recommend_crops(sunlight, water_needs, avg_temp, avg_humidity, avg_area, current_month)
        
        return jsonify(result)
    except KeyError as e:
        return jsonify({'error': f'Missing feature: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/recommend', methods=['POST'])
def recommend():
    try:
        data = request.get_json()
        
        # Extract features from the incoming JSON data
        location = data['location']  # User's location (city name)
        sunlight = data['sunlight']
        water_needs = data['water_needs']
        area = data['avg_area']
        include_companions = data.get('include_companions', False)
        
        # Ensure water_needs and sunlight match the case in crop.csv
        water_needs = water_needs.capitalize()  # Convert to capitalized form (e.g., 'medium' -> 'Medium')
        sunlight = sunlight.capitalize()  # Convert to capitalized form (e.g., 'full' -> 'Full')
        
        # Fetch weather data for the user's location
        weather_data = get_weather_data(location)
        if weather_data is None:
            return jsonify({'error': 'Could not fetch weather data.'}), 500
        
        # Extract temperature and humidity from the weather data
        avg_temp = weather_data['main']['temp']
        avg_humidity = weather_data['main']['humidity']
        current_month = time.strftime('%b')  # Use current month dynamically
        
        # Call the recommend_crops function with actual weather data
        recommended_crops = recommend_crops(sunlight, water_needs, avg_temp, avg_humidity, area, current_month)
        
        # Connect to the SQLite database
        conn = sqlite3.connect('PocketFarm.db')
        cursor = conn.cursor()

        # Prepare a list to hold crop details
        crops_with_details = []

        # Fetch details for each recommended crop
        for crop in recommended_crops['Crops']:
            crop_name = crop['Crop']
            cursor.execute("SELECT * FROM crops WHERE name = ?", (crop_name,))
            crop_details = cursor.fetchone()
            if crop_details:
                detailed_info = {
                    'id': crop_details[0],
                    'name': crop_details[1],
                    'imageURL': crop_details[2],
                    'scientific_name': crop_details[3],
                    'description': crop_details[4],
                    'origin': crop_details[5],
                    'growing_conditions': crop_details[6],
                    'planting_info': crop_details[7],
                    'care_instructions': crop_details[8],
                    'storage_info': crop_details[9],
                    'nutritional_info': crop_details[10],
                    'culinary_info': crop_details[11],
                    'recommended_info': {
                        'Crop': crop['Crop'],
                        'Avg Area': crop['Avg Area'],
                        'Drainage': crop['Drainage'],
                        'Companion Crop 1': crop['Companion Crop 1'],
                        'Companion Crop 2': crop['Companion Crop 2'],
                        'Soil Type': crop['Soil Type'],
                        'Potted': crop['Potted'],
                        'Sunlight': crop['Sunlight'],
                        'Water Needs': crop['Water Needs']
                    }
                }

                # Add companion crops if requested
                if include_companions:
                    companion_crops = []
                    if crop['Companion Crop 1']:
                        companion_crops.append(crop['Companion Crop 1'])
                    if crop['Companion Crop 2']:
                        companion_crops.append(crop['Companion Crop 2'])
                    detailed_info['companion_crops'] = companion_crops

                crops_with_details.append(detailed_info)

        conn.close()
        return jsonify(crops_with_details)
    except KeyError as e:
        return jsonify({'error': f'Missing feature: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    

@app.route('/crop/<crop_name>', methods=['GET'])
def get_crop_details(crop_name):
    """Get details for a specific crop."""
    try:
        conn = sqlite3.connect('PocketFarm.db')
        cursor = conn.cursor()
        crop_name=crop_name.capitalize()
        cursor.execute("SELECT * FROM crops WHERE name = ?", (crop_name,))
        crop = cursor.fetchone()

        conn.close()

        if crop is None:
            return jsonify({'error': 'Crop not found.'}), 404

        crop_details = {
            'id': crop[0],
            'name': crop[1],
            'imageURL': crop[2],
            'scientific_name': crop[3],
            'description': crop[4],
            'origin': crop[5],
            'growing_conditions': crop[6],
            'planting_info': crop[7],
            'care_instructions': crop[8],
            'storage_info': crop[9],
            'nutritional_info': crop[10],
            'culinary_info': crop[11]
        }

        return jsonify(crop_details)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/add_to_library', methods=['POST'])
def add_to_library():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        user_id = data.get('user_id')
        crop_name = data.get('crop_name')

        if not user_id or not crop_name:
            return jsonify({'error': 'Missing required fields: user_id or crop_name'}), 400

        conn = get_db()
        cursor = conn.cursor()

        try:
            # Start transaction
            cursor.execute('BEGIN TRANSACTION')

            # Check if the crop exists in the crops table
            cursor.execute("SELECT id FROM crops WHERE name = ?", (crop_name,))
            crop = cursor.fetchone()
            if not crop:
                cursor.execute('ROLLBACK')
                conn.close()
                return jsonify({'error': f'Crop "{crop_name}" not found in the database'}), 404

            # Check if the user exists
            cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
            user = cursor.fetchone()
            if not user:
                cursor.execute('ROLLBACK')
                conn.close()
                return jsonify({'error': f'User with id "{user_id}" not found'}), 404

            # Check if the crop is already in the user's library
            cursor.execute("SELECT * FROM user_crops WHERE user_id = ? AND crop_id = ?", (user_id, crop[0]))
            existing_entry = cursor.fetchone()
            if existing_entry:
                cursor.execute('COMMIT')
                conn.close()
                return jsonify({'message': 'Crop is already in your library!'}), 200

            # Insert the crop into the user's library
            cursor.execute("INSERT INTO user_crops (user_id, crop_id) VALUES (?, ?)", (user_id, crop[0]))

            # Commit transaction
            cursor.execute('COMMIT')
            conn.close()
            return jsonify({'message': 'Crop added to library successfully!'}), 200

        except sqlite3.Error as e:
            # Rollback transaction on error
            cursor.execute('ROLLBACK')
            conn.close()
            print(f"Database error in add_to_library: {str(e)}")
            return jsonify({'error': 'Database error occurred'}), 500
        except Exception as e:
            # Rollback transaction on error
            cursor.execute('ROLLBACK')
            conn.close()
            print(f"Error in add_to_library: {str(e)}")
            return jsonify({'error': str(e)}), 500

    except Exception as e:
        print(f"Error in add_to_library: {str(e)}")
        return jsonify({'error': str(e)}), 500
    

@app.route('/get_user_crops', methods=['GET'])
def get_user_crops():
    try:
        # Extract user_id from the Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authorization header is missing or invalid'}), 401

        user_id = auth_header.split(' ')[1]  # Extract user_id from the token

        # Connect to the database
        conn = sqlite3.connect('PocketFarm.db')
        cursor = conn.cursor()

        # Fetch the crops added by the user
        cursor.execute(
            "SELECT crops.name FROM user_crops JOIN crops ON user_crops.crop_id = crops.id WHERE user_crops.user_id = ?",
            (user_id,)
        )
        crops = cursor.fetchall()

        conn.close()

        # Format the response
        crop_list = [crop[0] for crop in crops]
        return jsonify(crop_list), 200
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    except Exception as e:
        print(f"Unexpected error: {e}")
        return jsonify({'error': str(e)}), 500



@app.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')  # Plain text password from the frontend
        phone = data.get('phone')
        location = data.get('location')  # { latitude, longitude }

        if not name or not email or not password:
            return jsonify({'error': 'Missing required fields: name, email, or password'}), 400
            
        # Basic email validation
        if '@' not in email or '.' not in email:
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Password strength validation
        password_errors = []
        
        if len(password) < 8:
            password_errors.append("Password must be at least 8 characters long")
        
        if not any(char.isupper() for char in password):
            password_errors.append("Password must contain at least one uppercase letter")
            
        if not any(char.isdigit() for char in password):
            password_errors.append("Password must contain at least one number")
            
        if not any(char in "!@#$%^&*()_+-=[]{}\\|;:'\",.<>/?`~" for char in password):
            password_errors.append("Password must contain at least one special character")
            
        if ' ' in password:
            password_errors.append("Password cannot contain spaces")
            
        if password_errors:
            return jsonify({
                'error': 'Password is not strong enough',
                'password_errors': password_errors
            }), 400
            
        # Check if email already exists
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        existing_user = cursor.fetchone()
        if existing_user:
            conn.close()
            return jsonify({'error': 'Email already registered'}), 409
        
        # Hash the password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        # If location is provided, geocode it to get city, state, and country
        city = state = country = None
        latitude = longitude = None
        
        # Check if location is provided and has valid coordinates
        valid_location = (location and 
                         location.get('latitude') is not None and 
                         location.get('longitude') is not None and
                         isinstance(location.get('latitude'), (int, float)) and
                         isinstance(location.get('longitude'), (int, float)))
        
        if valid_location:
            latitude = location.get('latitude')
            longitude = location.get('longitude')
            
            try:
                # Try to geocode the location
                geocode_result = cached_geocode(latitude, longitude)
                
                if geocode_result and geocode_result.get('data'):
                    data = geocode_result.get('data', {})
                    
                    if geocode_result.get('source') == "openweathermap":
                        city = data.get('name', 'Unknown')
                        state = data.get('state', 'Unknown')
                        country = data.get('country', 'Unknown')
                    else:
                        address = data.get('address', {})
                        city = address.get('city') or address.get('town') or address.get('village') or 'Unknown'
                        state = address.get('state', 'Unknown')
                        country = address.get('country', 'Unknown')
            except Exception as e:
                logger.error(f"Geocoding error: {str(e)}")
                # Continue with signup even if geocoding fails
                city = "Kochi"
                state = "Kerala"
                country = "India"
                # Keep the provided latitude and longitude
        else:
            # Set default values for location
            logger.info("No valid location provided during signup")
            city = "Kochi"
            state = "Kerala"
            country = "India"
            latitude = 9.9312
            longitude = 76.2673

        # Insert the user into the database with email_verified set to 0 (false)
        cursor.execute(
            "INSERT INTO users (name, email, password, phone, location_city, location_state, location_country, location_latitude, location_longitude, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
            (name, email, hashed_password, phone, city, state, country, latitude, longitude)
        )
        user_id = cursor.lastrowid
        
        # Generate verification token
        verification_token = str(uuid.uuid4())
        expires_at = (datetime.now() + timedelta(hours=24)).strftime('%Y-%m-%d %H:%M:%S')
        
        # Save token to database
        cursor.execute(
            "INSERT INTO verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            (user_id, verification_token, expires_at)
        )
        
        conn.commit()
        conn.close()
        
        # Send verification email
        email_sent = send_verification_email(email, verification_token, user_id)
        
        if not email_sent:
            logger.error(f"Failed to send verification email to {email}")
        
        # Return clear message that account requires verification
        return jsonify({
            'id': user_id,
            'name': name,
            'email': email,
            'phone': phone,
            'location': {
                'city': city,
                'state': state,
                'country': country,
                'latitude': latitude,
                'longitude': longitude,
            },
            'message': 'Account created successfully! Please check your email to verify your account before logging in.',
            'verification_sent': email_sent,
            'requires_verification': True,
            'email_verified': False
        }), 200
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Missing required fields: email or password'}), 400
            
        # Basic email validation
        if '@' not in email or '.' not in email:
            return jsonify({'error': 'Invalid email format'}), 400

        # Fetch the user from the database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        conn.close()

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Verify the password
        hashed_password = user[3]  # Password is stored in the 4th column
        if not bcrypt.checkpw(password.encode('utf-8'), hashed_password):
            return jsonify({'error': 'Invalid password'}), 401
            
        # Check if email is verified
        email_verified = user[10] if len(user) > 10 else False
        
        if not email_verified:
            return jsonify({
                'error': 'Email not verified',
                'user_id': user[0],
                'email': user[2],
                'requires_verification': True
            }), 403

        # Join the user's socket room for weather updates
        socketio.emit('join_room', {'room': f'user_{user[0]}'})

        # Return the user data including location
        return jsonify({
            'id': user[0],
            'name': user[1],
            'email': user[2],
            'phone': user[4] if len(user) > 4 else None,
            'location': {
                'city': user[5] if len(user) > 5 else None,
                'state': user[6] if len(user) > 6 else None,
                'country': user[7] if len(user) > 7 else None,
                'latitude': user[8] if len(user) > 8 else None,
                'longitude': user[9] if len(user) > 9 else None,
            },
            'email_verified': True
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@socketio.on('join_room')
def on_join(data):
    """Handle socket room joining."""
    room = data['room']
    join_room(room)
    print(f"Client joined room: {room}")

@socketio.on('disconnect')
def on_disconnect():
    """Handle socket disconnection."""
    print("Client disconnected")

@app.route('/weather', methods=['POST'])
def get_weather():
    """Fetch weather data for a specific location."""
    try:
        data = request.get_json()
        location = data.get('location')  # Location can be a city name or coordinates

        if not location:
            return jsonify({'error': 'Location is required'}), 400

        # Fetch weather data from OpenWeatherMap API
        weather_data = get_weather_data(location)
        if not weather_data:
            return jsonify({'error': 'Failed to fetch weather data'}), 500

        # Extract relevant weather information
        weather_info = {
            'temp': weather_data['main']['temp'],
            'condition': weather_data['weather'][0]['main'],
            'humidity': weather_data['main']['humidity'],
            'wind_speed': weather_data['wind']['speed'],
            'icon': weather_data['weather'][0]['icon'],  # Weather icon code
        }

        return jsonify(weather_info), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/remove_from_garden', methods=['POST'])
def remove_from_garden():
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        crop_name = data.get('crop_name')

        if not user_id or not crop_name:
            return jsonify({'error': 'Missing required fields: user_id or crop_name'}), 400

        # Connect to the database
        conn = sqlite3.connect('PocketFarm.db')
        cursor = conn.cursor()

        # Fetch the crop ID
        cursor.execute("SELECT id FROM crops WHERE name = ?", (crop_name,))
        crop = cursor.fetchone()
        if not crop:
            conn.close()
            return jsonify({'error': f'Crop "{crop_name}" not found in the database'}), 404

        # Delete the crop from the user's garden
        cursor.execute("DELETE FROM user_crops WHERE user_id = ? AND crop_id = ?", (user_id, crop[0]))
        conn.commit()
        conn.close()

        return jsonify({'message': 'Crop removed from garden successfully!'}), 200
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return jsonify({'error': 'Database error occurred'}), 500
    except Exception as e:
        print(f"Unexpected error: {e}")
        return jsonify({'error': str(e)}), 500   
    

@app.route('/user_schedule/<int:user_id>', methods=['GET'])
def get_user_schedules(user_id):
    try:
        print(f"Fetching schedules for user {user_id}")  # Debug log
        conn = get_db()
        cursor = conn.cursor()

        # First check if the user exists
        cursor.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            print(f"User {user_id} not found")  # Debug log
            conn.close()
            return jsonify({'error': f'User {user_id} not found'}), 404

        # Check if user has any schedules
        cursor.execute('''
            SELECT COUNT(*) FROM watering_schedules WHERE user_id = ?
        ''', (user_id,))
        schedule_count = cursor.fetchone()[0]
        print(f"Found {schedule_count} schedules for user {user_id}")  # Debug log

        # Fetch all schedules for the user with crop details
        cursor.execute('''
            SELECT 
                c.name,
                c.imageURL,
                ws.last_watered,
                ws.next_watering,
                cs.growing_time,
                cs.watering_frequency,
                cs.fertilization_schedule,
                ws.water_status
            FROM watering_schedules ws
            JOIN crops c ON ws.crop_id = c.id
            JOIN crop_schedule cs ON c.name = cs.crop_name
            WHERE ws.user_id = ?
        ''', (user_id,))
        schedules = cursor.fetchall()
        print(f"Successfully fetched {len(schedules)} schedules")  # Debug log

        conn.close()

        # Format the response
        schedule_list = [dict(schedule) for schedule in schedules]
        return jsonify(schedule_list), 200
    except sqlite3.Error as e:
        print(f"Database error in get_user_schedules: {str(e)}")  # Debug log
        return jsonify({'error': f'Database error: {str(e)}'}), 500
    except Exception as e:
        print(f"Error in get_user_schedules: {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 500

@app.route('/notifications/<int:user_id>', methods=['GET'])
def get_user_notifications(user_id):
    try:
        print(f"Fetching notifications for user {user_id}")  # Debug log
        conn = get_db()
        cursor = conn.cursor()

        # Get notifications from the database
        cursor.execute("""
            SELECT id, message, timestamp, read_status 
            FROM notifications 
            WHERE user_id = ? 
            ORDER BY timestamp DESC
        """, (user_id,))
        notifications = cursor.fetchall()
        print(f"Found {len(notifications) if notifications else 0} notifications")  # Debug log

        # Format notifications
        formatted_notifications = [{
            'id': notification[0],
            'message': notification[1],
            'timestamp': notification[2],
            'read': bool(notification[3])  # Map read_status to read
        } for notification in notifications]

        print(f"Returning formatted notifications: {formatted_notifications}")  # Debug log
        return jsonify(formatted_notifications)
    except Exception as e:
        print(f"Error fetching notifications: {str(e)}")
        return jsonify({'error': 'Failed to fetch notifications'}), 500

def create_notification(user_id, message):
    """Helper function to create a notification for a user."""
    max_retries = 3
    retry_delay = 1  # seconds
    
    for attempt in range(max_retries):
        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO notifications (user_id, message)
                VALUES (?, ?)
            """, (user_id, message))
            conn.commit()
            conn.close()
            return
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e) and attempt < max_retries - 1:
                print(f"Database locked, retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                print(f"Error creating notification: {str(e)}")
                raise
        except Exception as e:
            print(f"Error creating notification: {str(e)}")
            raise

def send_verification_email(to_email, verification_token, user_id):
    """Send a verification email to the user."""
    try:
        # Get email credentials from environment variables
        email_user = os.getenv('EMAIL_USER')
        email_password = os.getenv('EMAIL_PASSWORD')
        
        if not email_user or not email_password:
            logger.error("Email credentials are missing. Set EMAIL_USER and EMAIL_PASSWORD in .env file.")
            return False
            
        # Log email credentials (partially hidden)
        logger.info(f"Using email: {email_user}")
        
        # Create verification link with correct port (8081 instead of 8080)
        verification_link = f"https://localhost:8081/verify-email?token={verification_token}&user_id={user_id}"
        
        # Email content
        subject = "Verify your PocketFarm account"
        html_content = f"""
        <html>
        <body>
            <h2>Welcome to PocketFarm!</h2>
            <p>Thank you for signing up. Please verify your email address by clicking the link below:</p>
            <p><a href="{verification_link}">Verify Email</a></p>
            <p>If you didn't create this account, you can ignore this email.</p>
            <p>Best regards,<br>The PocketFarm Team</p>
        </body>
        </html>
        """
        
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = email_user
            message["To"] = to_email
            
            # Add HTML content
            html_part = MIMEText(html_content, "html")
            message.attach(html_part)
            
            # Connect to Gmail SMTP server
            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(email_user, email_password)
                server.sendmail(email_user, to_email, message.as_string())
            
            logger.info(f"Verification email sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email with smtplib: {str(e)}")
            return False
            
    except Exception as e:
        logger.error(f"Error in email sending: {str(e)}")
        return False

@app.route('/mark_notifications_read/<int:user_id>', methods=['POST'])
def mark_notifications_read(user_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE notifications 
            SET read_status = 1 
            WHERE user_id = ? AND read_status = 0
        """, (user_id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'All notifications marked as read'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/users', methods=['GET'])
def get_users():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, email, location_city, location_state, location_country 
            FROM users
        """)
        users = cursor.fetchall()
        conn.close()
        
        formatted_users = [{
            'id': user[0],
            'name': user[1],
            'email': user[2],
            'location': f"{user[3]}, {user[4]}, {user[5]}" if user[3] and user[4] and user[5] else "Not set"
        } for user in users]
        
        return jsonify(formatted_users), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/verify-email', methods=['GET'])
def verify_email():
    """Verify user's email address."""
    try:
        token = request.args.get('token')
        user_id = request.args.get('user_id')
        
        if not token or not user_id:
            return jsonify({'error': 'Invalid verification link'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if the token is valid
        cursor.execute("""
            SELECT * FROM verification_tokens 
            WHERE user_id = ? AND token = ? AND expires_at > datetime('now')
        """, (user_id, token))
        verification = cursor.fetchone()
        
        if not verification:
            conn.close()
            return jsonify({'error': 'Invalid or expired verification link'}), 400
            
        # Update user's verification status
        cursor.execute("""
            UPDATE users 
            SET email_verified = 1 
            WHERE id = ?
        """, (user_id,))
        
        # Delete used token
        cursor.execute("""
            DELETE FROM verification_tokens 
            WHERE user_id = ? AND token = ?
        """, (user_id, token))
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': 'Email verified successfully!'}), 200
    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/resend-verification', methods=['POST'])
def resend_verification():
    """Resend verification email."""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
            
        logger.info(f"Resending verification email to: {email}")
            
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if user exists and is not already verified
        cursor.execute("""
            SELECT id, email_verified FROM users 
            WHERE email = ?
        """, (email,))
        user = cursor.fetchone()
        
        if not user:
            logger.error(f"User not found for email: {email}")
            conn.close()
            return jsonify({'error': 'User not found'}), 404
            
        user_id, is_verified = user
        
        if is_verified:
            logger.info(f"Email already verified for: {email}")
            conn.close()
            return jsonify({'message': 'Email is already verified'}), 200
            
        # Delete any existing tokens
        cursor.execute("""
            DELETE FROM verification_tokens 
            WHERE user_id = ?
        """, (user_id,))
        
        # Generate new verification token
        verification_token = str(uuid.uuid4())
        expires_at = (datetime.now() + timedelta(hours=24)).strftime('%Y-%m-%d %H:%M:%S')
        
        # Save token to database
        cursor.execute("""
            INSERT INTO verification_tokens (user_id, token, expires_at)
            VALUES (?, ?, ?)
        """, (user_id, verification_token, expires_at))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Generated new verification token for user: {user_id}")
        
        # Send verification email
        email_sent = send_verification_email(email, verification_token, user_id)
        
        if email_sent:
            logger.info(f"Successfully sent verification email to: {email}")
            return jsonify({'message': 'Verification email sent successfully!'}), 200
        else:
            logger.error(f"Failed to send verification email to: {email}")
            return jsonify({'error': 'Failed to send verification email. Please check server logs for details.'}), 500
    except Exception as e:
        logger.error(f"Resend verification error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/nurseries', methods=['GET', 'POST'])
def get_nurseries():
    try:
        # Get coordinates from either query parameters (GET) or request body (POST)
        if request.method == 'POST':
            data = request.get_json()
            lat = data.get('latitude')
            lon = data.get('longitude')
        else:
            lat = request.args.get('lat')
            lon = request.args.get('lon')
        
        radius = request.args.get('radius', '50000')  # 50km radius

        if not lat or not lon:
            return jsonify({'error': 'Latitude and longitude are required'}), 400

        # Use Overpass API to fetch nurseries with expanded search criteria
        overpass_url = "http://overpass-api.de/api/interpreter"
        query = f"""
        [out:json][timeout:25];
        (
          // Garden centers and nurseries
          node["shop"="garden_centre"](around:{radius},{lat},{lon});
          node["shop"="plant_nursery"](around:{radius},{lat},{lon});
          node["shop"="agricultural_supplies"](around:{radius},{lat},{lon});
          node["shop"="agrarian"](around:{radius},{lat},{lon});
          node["shop"="farm"](around:{radius},{lat},{lon});
          node["shop"="seeds"](around:{radius},{lat},{lon});
          node["shop"="fertilizer"](around:{radius},{lat},{lon});
          
          // Plant-related amenities
          node["amenity"="marketplace"]["plant"](around:{radius},{lat},{lon});
          node["amenity"="garden_centre"](around:{radius},{lat},{lon});
          node["amenity"="plant_school"](around:{radius},{lat},{lon});
          node["amenity"="greenhouse"](around:{radius},{lat},{lon});
          
          // Additional plant-related businesses
          node["shop"="florist"]["plant"](around:{radius},{lat},{lon});
          node["shop"="garden_furniture"](around:{radius},{lat},{lon});
          node["shop"="landscape"](around:{radius},{lat},{lon});
        );
        out body;
        >;
        out skel qt;
        """
        
        response = requests.post(overpass_url, data=query)
        response.raise_for_status()
        data = response.json()

        # Format the response
        nurseries = []
        for element in data.get('elements', []):
            if 'tags' in element:
                # Get coordinates from either node or way/relation
                element_lat = element.get('lat') or element.get('center', {}).get('lat')
                element_lon = element.get('lon') or element.get('center', {}).get('lon')
                
                if element_lat and element_lon:
                    # Calculate distance using the Haversine formula
                    R = 6371  # Earth's radius in kilometers
                    lat1, lon1 = float(lat), float(lon)
                    lat2, lon2 = float(element_lat), float(element_lon)
                    
                    dlat = math.radians(lat2 - lat1)
                    dlon = math.radians(lon2 - lon1)
                    a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
                    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                    distance = R * c
                    
                    # Get the name from various possible tags
                    name = (
                        element.get('tags', {}).get('name') or
                        element.get('tags', {}).get('name:en') or
                        element.get('tags', {}).get('brand') or
                        element.get('tags', {}).get('shop') or
                        element.get('tags', {}).get('amenity') or
                        'Unnamed Garden Center'
                    )
                    
                    # Get basic details first
                    tags = element.get('tags', {})
                    phone = tags.get('phone', 'Phone not available')
                    website = tags.get('website', '')
                    opening_hours = tags.get('opening_hours', 'Hours not available')
                    business_type = tags.get('shop') or tags.get('amenity') or 'garden_centre'
                    
                    # Initial response with basic address
                    nursery = {
                        'id': element.get('id'),
                        'name': name,
                        'address': 'Loading address...',  # Initial placeholder
                        'lat': element_lat,
                        'lon': element_lon,
                        'phone': phone,
                        'website': website,
                        'opening_hours': opening_hours,
                        'type': business_type,
                        'distance': round(distance, 1),
                        'address_loading': True  # Flag to indicate address is being loaded
                    }
                    nurseries.append(nursery)

        # Sort nurseries by distance
        nurseries.sort(key=lambda x: x['distance'])
        
        # Start background thread to update addresses
        def update_addresses():
            for nursery in nurseries:
                try:
                    # Use our cached_geocode function which handles rate limiting and fallbacks
                    result = cached_geocode(nursery['lat'], nursery['lon'])
                    source = result["source"]
                    geocode_data = result["data"]

                    if source == "openweathermap":
                        # Extract details from OpenWeatherMap response
                        city = geocode_data.get('name', 'Unknown City')
                        state = geocode_data.get('state', 'Unknown State')
                        country = geocode_data.get('country', 'Unknown Country')
                        address = f"{city}, {state}, {country}"
                    else:
                        # Extract details from Nominatim response
                        address = geocode_data.get('display_name', 'Address not available')

                    # Update the nursery's address
                    nursery['address'] = address
                    nursery['address_loading'] = False
                except Exception as e:
                    print(f"Error updating address for nursery {nursery['id']}: {str(e)}")
                    nursery['address'] = "Address not available"
                    nursery['address_loading'] = False
                time.sleep(1)  # Rate limiting between requests

        # Start the background thread
        threading.Thread(target=update_addresses, daemon=True).start()
        
        return jsonify({'nurseries': nurseries}), 200
        
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Failed to fetch nurseries: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/clear_notifications/<int:user_id>', methods=['POST'])
def clear_notifications(user_id):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM notifications WHERE user_id = ?", (user_id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'All notifications cleared'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def check_unwatered_crops():
    """Check for unwatered crops and send notifications."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get all unwatered crops that are due for watering
        cursor.execute('''
            SELECT ws.id, ws.user_id, c.name, ws.next_watering
            FROM watering_schedules ws
            JOIN crops c ON ws.crop_id = c.id
            WHERE ws.water_status = 0 
            AND ws.next_watering <= date('now')
        ''')
        unwatered_crops = cursor.fetchall()
        
        for crop in unwatered_crops:
            schedule_id, user_id, crop_name, next_watering = crop
            
            # Create notification for unwatered crop
            notification_message = f"Your {crop_name} needs watering! It was due on {next_watering}."
            create_notification(user_id, notification_message)
            
            # Update next watering to 3 hours from now
            next_watering = (datetime.now() + timedelta(hours=3)).strftime('%Y-%m-%d %H:%M:%S')
            cursor.execute('''
                UPDATE watering_schedules
                SET next_watering = ?
                WHERE id = ?
            ''', (next_watering, schedule_id))
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error checking unwatered crops: {str(e)}")

# Start a background thread to check for unwatered crops every 3 hours
def start_unwatered_crops_checker():
    while True:
        check_unwatered_crops()
        time.sleep(10800)  # Sleep for 3 hours

def verify_database_schema():
    """Verify that all required tables exist with correct schema."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if tables exist
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('users', 'crops', 'watering_schedules', 'crop_schedule', 'verification_tokens')
        """)
        existing_tables = [row[0] for row in cursor.fetchall()]
        
        required_tables = ['users', 'crops', 'watering_schedules', 'crop_schedule', 'verification_tokens']
        missing_tables = [table for table in required_tables if table not in existing_tables]
        
        if 'verification_tokens' in missing_tables:
            logger.info("Creating verification_tokens table...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS verification_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            conn.commit()
            missing_tables.remove('verification_tokens')
            
        # Check if users table has email_verified column
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'email_verified' not in columns:
            logger.info("Adding email_verified column to users table...")
            cursor.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0")
            conn.commit()
        
        if missing_tables:
            print(f"Missing tables: {missing_tables}")
            return False
            
        # Check table schemas
        for table in required_tables:
            if table in existing_tables:
                cursor.execute(f"PRAGMA table_info({table})")
                columns = cursor.fetchall()
                print(f"\n{table} table schema:")
                for col in columns:
                    print(f"  {col[1]} ({col[2]})")
        
        conn.close()
        return True
    except Exception as e:
        print(f"Error verifying database schema: {str(e)}")
        return False

@app.route('/google_auth', methods=['POST'])
def google_auth():
    """Handle Google OAuth authentication with a simpler flow."""
    try:
        data = request.get_json()
        code = data.get('code')
        email = data.get('email')
        name = data.get('name')
        
        if not email or not name:
            return jsonify({'error': 'Email and name are required'}), 400
            
        logger.info(f"Google Auth - Processing for email: {email}")
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if user exists
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        
        if not user:
            # Create a new user with email verified
            # Use random password since login is via Google
            hashed_password = bcrypt.hashpw(os.urandom(16), bcrypt.gensalt())
            
            # Get default location for new users (Kochi)
            city = "Kochi"
            state = "Kerala"
            country = "India"
            latitude = 9.9312
            longitude = 76.2673
            
            cursor.execute(
                "INSERT INTO users (name, email, password, location_city, location_state, location_country, location_latitude, location_longitude, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
                (name, email, hashed_password, city, state, country, latitude, longitude)
            )
            conn.commit()
            
            # Get the newly created user
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
        elif user and len(user) > 10 and user[10] == 0:
            # If user exists but email not verified, mark as verified now
            cursor.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user[0],))
            conn.commit()
            
            # Refresh user data
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            
        conn.close()
        logger.info(f"Google Auth - Successfully authenticated user: {email}")
        
        # Return user data with email_verified flag
        return jsonify({
            'id': user[0],
            'name': user[1],
            'email': user[2],
            'phone': user[4] if len(user) > 4 else None,
            'location': {
                'city': user[5] if len(user) > 5 else None,
                'state': user[6] if len(user) > 6 else None,
                'country': user[7] if len(user) > 7 else None,
                'latitude': user[8] if len(user) > 8 else None,
                'longitude': user[9] if len(user) > 9 else None,
            },
            'email_verified': True
        }), 200
    except Exception as e:
        logger.error(f"Google auth error: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete_account', methods=['POST'])
def delete_account():
    """Delete a user account and all associated data."""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
            
        conn = get_db()
        cursor = conn.cursor()
        
        try:
            # Start transaction for atomicity
            cursor.execute('BEGIN TRANSACTION')
            
            # Delete verification tokens
            cursor.execute("DELETE FROM verification_tokens WHERE user_id = ?", (user_id,))
            
            # Delete notifications
            cursor.execute("DELETE FROM notifications WHERE user_id = ?", (user_id,))
            
            # Delete watering schedules
            cursor.execute("DELETE FROM watering_schedules WHERE user_id = ?", (user_id,))
            
            # Delete user crops
            cursor.execute("DELETE FROM user_crops WHERE user_id = ?", (user_id,))
            
            # Delete user account
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            
            # Commit all changes
            cursor.execute('COMMIT')
            
            logger.info(f"Account deleted for user ID: {user_id}")
            return jsonify({'message': 'Account and all associated data have been deleted successfully'}), 200
            
        except Exception as e:
            # Rollback in case of error
            cursor.execute('ROLLBACK')
            logger.error(f"Error during account deletion: {str(e)}")
            return jsonify({'error': f'Failed to delete account: {str(e)}'}), 500
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Account deletion error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Verify database schema before starting
    if not verify_database_schema():
        print("Database schema verification failed. Please check the database setup.")
        exit(1)
        
    # Start the background thread to check for unwatered crops
    threading.Thread(target=start_unwatered_crops_checker, daemon=True).start()
    
    # Start the background thread to fetch weather data
    threading.Thread(target=fetch_weather_alerts, daemon=True).start()
    
    # Run the Flask app with SocketIO
    socketio.run(app, debug=True)
