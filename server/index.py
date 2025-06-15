from flask import Flask, request, jsonify
import psycopg2
import os
from dotenv import load_dotenv
import requests
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])

@app.route("/")
def index():
    return "Backend is running!"

# Database connection
conn = psycopg2.connect(os.getenv("DATABASE_URL"), sslmode='require')
cursor = conn.cursor()
#conn.close()

@app.route("/api/data", methods=["GET"])
def get_data():
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM court_busy_data")
            rows = cursor.fetchall()
            return jsonify(rows)
    except Exception as e:
        print("Database error:", e)
        return "Error fetching data", 500

@app.route("/api/closest-court", methods=["POST"])
def closest_court():
    if not request.is_json:
        return jsonify({"error": "Invalid content-type, expecting application/json"}), 400
    try:
        data = request.get_json()
        user = data.get("userLocation")
        courts = data.get("courts")

        if not user or not courts:
            return jsonify({"error": "Missing userLocation or courts"}), 400

        destinations = "|".join([f"{c['lat']},{c['lng']}" for c in courts])
        url = (
            f"https://maps.googleapis.com/maps/api/distancematrix/json?"
            f"origins={user['latitude']},{user['longitude']}&"
            f"destinations={destinations}&departure_time=now&traffic_model=best_guess&"
            f"key={os.getenv('GOOGLE_MAPS_API_KEY')}"
        )

        print("Requesting matrix with URL", url)
        headers = {'Accept': 'application/json'}
        res = requests.get(url, headers=headers)
        matrix = res.json()
        print("Distance Matrix API response:", matrix)

        enriched = []
        for i, court in enumerate(courts):
            element = matrix["rows"][0]["elements"][i]
            enriched.append({
                **court,
                "distance_text": element.get("distance", {}).get("text"),
                "distance_value": element.get("distance", {}).get("value"),
                "duration_text": element.get("duration_in_traffic", {}).get("text"),
                "duration_value": element.get("duration_in_traffic", {}).get("value")
            })

        return jsonify(enriched)
    except Exception as e:
        print("Distance matrix error:", e)
        return jsonify({"error": "Error calculating distance"}), 500
    

# @app.route("/api/geocode-courts", methods=["POST"])
# def geocode_courts():
#     try:
#         court_names = request.get_json()["courtNames"]
#         print("Received courtNames from frontend:", court_names)
#         results = []

#         for name in court_names:
#             query = f"{name}, North Carolina"

#             geo_url = (
#                 f"https://maps.googleapis.com/maps/api/geocode/json?"
#                 f"address={requests.utils.quote(query)}&key={os.getenv('GOOGLE_MAPS_API_KEY')}"
#             )
#             print("Trying Geocode API:", geo_url)
#             res = requests.get(geo_url)
#             geo = res.json()

#             if geo["status"] == "OK":
#                 loc = geo["results"][0]["geometry"]["location"]
#                 results.append({"name": name, "lat": loc["lat"], "lng": loc["lng"]})
#                 continue

#             # fallback to Places API
#             print(f"Geocode failed for {name}, status: {geo['status']}, trying Places API")
#             place_url = (
#                 f"https://maps.googleapis.com/maps/api/place/textsearch/json?"
#                 f"query={requests.utils.quote(query)}&key={os.getenv('GOOGLE_MAPS_API_KEY')}"
#             )
#             res = requests.get(place_url)
#             place = res.json()
#             if place["status"] == "OK":
#                 loc = place["results"][0]["geometry"]["location"]
#                 results.append({"name": name, "lat": loc["lat"], "lng": loc["lng"]})
#             else:
#                 print(f"Could not geocode {name} → {place['status']}")

#         print("Final geocoded results:", results)
#         return jsonify(results)
#     except Exception as e:
#         print("Geocoding error:", e)
#         return "Error geocoding courts", 500

if __name__ == "__main__":
    app.run(port=3001, debug=True)