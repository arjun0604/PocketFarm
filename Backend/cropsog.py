import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

# Load the dataset
data = pd.read_csv('crop.csv')

# Preprocess the data
X = data[['Sunlight', 'Water Needs', 'Avg Temp', 'Avg Humidity', 'Avg Area']]
y = data[['Crop', 'Drainage', 'Terrace/Backyard', 'Companion Crop 1', 'Companion Crop 2', 'Soil Type', 'Potted']]

# One-hot encode categorical features
preprocessor = ColumnTransformer(
    transformers=[
        ('cat', OneHotEncoder(), ['Sunlight', 'Water Needs']),
    ],
    remainder='passthrough'
)

# Create a pipeline with preprocessing and model
model = Pipeline(steps=[
    ('preprocessor', preprocessor),
    ('classifier', RandomForestClassifier())
])

# Split the data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train the model
model.fit(X_train, y_train)

# Function to recommend crops based on the current month
def recommend_crops(sunlight, water_needs, avg_temp, avg_humidity, avg_area, current_month):
    # Check if the current month is valid
    if current_month not in ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']:
        return "Invalid month abbreviation"

    # Create a DataFrame for the input parameters
    input_data = pd.DataFrame({
        'Sunlight': [sunlight],
        'Water Needs': [water_needs],
        'Avg Temp': [avg_temp],
        'Avg Humidity': [avg_humidity],
        'Avg Area': [avg_area]
    })
    
    # Function to get recommendations
    def get_recommendations(input_data):
        predictions = model.predict(input_data)
        predicted_crops = predictions.flatten()  # Ensure it's a 1D array

        # Filter crops based on the current month
        suitable_crops = data[data[current_month] == 1]

        # Adjust compatibility for water needs and sunlight
        if water_needs == 'Medium':
            compatible_water_crops = suitable_crops[suitable_crops['Water Needs'].isin(['Medium', 'High'])]
        elif water_needs == 'High':
            compatible_water_crops = suitable_crops[suitable_crops['Water Needs'].isin(['High', 'Medium'])]
        else:
            compatible_water_crops = suitable_crops[suitable_crops['Water Needs'] == water_needs]

        if sunlight == 'Full':
            compatible_sunlight_crops = compatible_water_crops[compatible_water_crops['Sunlight'].isin(['Full', 'Partial'])]
        else:
            compatible_sunlight_crops = compatible_water_crops[compatible_water_crops['Sunlight'] == sunlight]

        # Filter crops based on area
        area_filtered_crops = compatible_sunlight_crops[compatible_sunlight_crops['Avg Area'] < avg_area]

        # Get crops that are both predicted and suitable for the month
        recommended_crops = area_filtered_crops[area_filtered_crops['Crop'].isin(predicted_crops)]

        return recommended_crops, suitable_crops

    # Get initial recommendations
    recommended_crops, suitable_crops = get_recommendations(input_data)

    # Adjust parameters if fewer than 2 crops are found
    adjustments = [
        (2, 0, 0), (-2, 0, 0),  # Adjust Avg Temp
        (0, 5, 0), (0, -5, 0),  # Adjust Avg Humidity
        (0, 0, 1), (0, 0, -1),  # Adjust Avg Area
        (4, 0, 0), (-4, 0, 0),  # More adjustments for Avg Temp
        (0, 10, 0), (0, -10, 0),  # More adjustments for Avg Humidity
        (0, 0, 2), (0, 0, -2),  # More adjustments for Avg Area
        (6, 0, 0), (-6, 0, 0),  # Even more adjustments for Avg Temp
        (0, 15, 0), (0, -15, 0),  # Even more adjustments for Avg Humidity
        (0, 0, 3), (0, 0, -3)   # Even more adjustments for Avg Area
    ]

    for temp_change, humidity_change, area_change in adjustments:
        if len(recommended_crops) >= 2:
            break
        # Adjust parameters
        adjusted_avg_temp = avg_temp + temp_change
        adjusted_avg_humidity = avg_humidity + humidity_change
        adjusted_avg_area = avg_area + area_change

        # Create new input data with adjusted parameters
        adjusted_input_data = pd.DataFrame({
            'Sunlight': [sunlight],
            'Water Needs': [water_needs],
            'Avg Temp': [adjusted_avg_temp],
            'Avg Humidity': [adjusted_avg_humidity],
            'Avg Area': [adjusted_avg_area]
        })

        # Get new recommendations
        recommended_crops, _ = get_recommendations(adjusted_input_data)

    # If still no crops are found, return a message
    if recommended_crops.empty:
        return "No suitable crops found for the given parameters."

    # Filter all suitable crops based on the average area condition
    all_suitable_crops = suitable_crops[suitable_crops['Avg Area'] <= avg_area]

    # Return all recommended crops along with their companion crops and additional details
    return {
        "Recommended Crops": recommended_crops[['Crop', 'Drainage', 'Terrace/Backyard', 'Companion Crop 1', 'Companion Crop 2', 'Soil Type', 'Potted', 'Sunlight', 'Water Needs', 'Avg Area']],
        "All Suitable Crops": all_suitable_crops[['Crop', 'Drainage', 'Terrace/Backyard', 'Companion Crop 1', 'Companion Crop 2', 'Soil Type', 'Potted', 'Sunlight', 'Water Needs', 'Avg Area']]
    }

# Example usage
#result = recommend_crops('Full', 'High', 27, 83, 10, 'Jan')  # Example input with current month as 'May'
#print(result)
