import sqlite3
import pandas as pd
from contextlib import contextmanager

DATABASE_FILE = 'PocketFarm.db'

@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    try:
        yield conn
    finally:
        conn.close()

@contextmanager
def get_db_cursor():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            yield cursor
        finally:
            cursor.close()
        conn.commit()

def check_column_exists(table, column, cursor):
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [info[1] for info in cursor.fetchall()]
    return column in columns

def initialize_database():
    with get_db_cursor() as cursor:
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            phone TEXT,
            location_city TEXT,
            location_state TEXT,
            location_country TEXT,
            location_latitude REAL,
            location_longitude REAL,
            notification_enabled BOOLEAN DEFAULT 1,
            last_alert_check TIMESTAMP,
            last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            email_verified INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS crops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            imageURL TEXT,
            scientific_name TEXT,
            description TEXT,
            origin TEXT,
            growing_conditions TEXT,
            planting_info TEXT,
            care_instructions TEXT,
            storage_info TEXT,
            nutritional_info TEXT,
            culinary_info TEXT
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS weather_instructions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type TEXT NOT NULL UNIQUE,
            instructions TEXT NOT NULL
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS watering_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            crop_id INTEGER NOT NULL,
            last_watered DATE NULL,
            next_watering DATE,
            watering_frequency INTEGER,
            fertilization_schedule INTEGER,
            water_status BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
            UNIQUE(user_id, crop_id)
        )
        ''')

        if not check_column_exists('watering_schedules', 'water_status', cursor):
            cursor.execute('''
            ALTER TABLE watering_schedules
            ADD COLUMN water_status BOOLEAN DEFAULT 0
            ''')

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_watering_schedules_user_id ON watering_schedules(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_watering_schedules_crop_id ON watering_schedules(crop_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_watering_schedules_next_watering ON watering_schedules(next_watering)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_watering_schedules_water_status ON watering_schedules(water_status)')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_crops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            crop_id INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (crop_id) REFERENCES crops(id) ON DELETE CASCADE,
            UNIQUE(user_id, crop_id)
        )
        ''')

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_crops_user_id ON user_crops(user_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_crops_crop_id ON user_crops(crop_id)')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS notification_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            watering_reminders BOOLEAN DEFAULT 1,
            weather_alerts BOOLEAN DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS weather_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            alert_type TEXT NOT NULL,
            alert_message TEXT NOT NULL,
            alert_date DATE NOT NULL,
            alert_status TEXT DEFAULT 'pending',
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS crop_schedule (
            crop_name TEXT PRIMARY KEY,
            growing_time INTEGER,
            watering_frequency INTEGER,
            fertilization_schedule INTEGER
        )
        ''')

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_crops_name ON crops(name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_crop_schedule_crop_name ON crop_schedule(crop_name)')

        cursor.execute("SELECT COUNT(*) FROM crops")
        if cursor.fetchone()[0] == 0:
            print("Initializing crops data...")
            df_crops = pd.read_csv('cropdata.csv')
            df_crops.to_sql('crops', cursor.connection, if_exists='append', index=False)

        cursor.execute("SELECT COUNT(*) FROM crop_schedule")
        if cursor.fetchone()[0] == 0:
            print("Initializing crop schedule data...")
            df_schedule = pd.read_csv('crop_schedule_numerical.csv')
            df_schedule.to_sql('crop_schedule', cursor.connection, if_exists='append', index=False)

        cursor.execute("SELECT COUNT(*) FROM weather_instructions")
        if cursor.fetchone()[0] == 0:
            print("Initializing weather instructions...")
            weather_instructions = [
                ("Rain", "Ensure proper drainage in your garden. Cover sensitive plants."),
                ("Frost", "Cover plants with cloth or bring them indoors. Water them well."),
                ("Heatwave", "Provide shade for plants and ensure they are well-watered."),
                ("Flood", "Move potted plants to higher ground and ensure drainage."),
                ("Strong Wind", "Secure plants and structures to prevent damage."),
                ("Storm", "Bring potted plants indoors and secure garden structures."),
            ]
            cursor.executemany("INSERT INTO weather_instructions (alert_type, instructions) VALUES (?, ?)", weather_instructions)

        print("Database initialization complete.")

if __name__ == "__main__":
    initialize_database()
