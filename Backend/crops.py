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

# List of months for easy navigation
months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

# Function to recommend crops based on the current month
def recommend_crops(sunlight, water_needs, avg_temp, avg_humidity, avg_area, current_month):
    # Check if the current month is valid
    if current_month not in months:
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

    # If no suitable crops are found, check the next month
    if recommended_crops.empty and suitable_crops.empty:
        current_index = months.index(current_month)
        next_month_index = (current_index + 1) % len(months)  # Wrap around to the start if December
        next_month = months[next_month_index]

        # Get recommendations for the next month
        input_data['current_month'] = next_month
        recommended_crops, suitable_crops = get_recommendations(input_data)

        # If still no crops are found, return a message without the checked months
        if recommended_crops.empty and suitable_crops.empty:
            suggested_months = [month for month in months if month not in [current_month, next_month]]
            return {
                "message": f"No suitable crops found for {current_month} or {next_month}.",
                "suggested_months": suggested_months
            }

    # Combine recommended and suitable crops
    combined_crops = pd.concat([recommended_crops, suitable_crops]).drop_duplicates()

    # Limit the total number of crops to 6
    combined_crops = combined_crops.head(8)

    # Return all recommended crops along with their companion crops and additional details
    return {
        "Crops": combined_crops[['Crop', 'Drainage', 'Terrace/Backyard', 'Companion Crop 1', 'Companion Crop 2', 'Soil Type', 'Potted', 'Sunlight', 'Water Needs', 'Avg Area']].to_dict(orient='records')
    }

# Example usage
# result = recommend_crops('Full', 'High', 27, 83, 10, 'Jan')  # Example input with current month as 'May'
# print(result)
