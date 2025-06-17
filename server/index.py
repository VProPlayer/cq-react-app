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

        enriched = []
        for court in courts:
            try:
                compute_url = f"https://routes.googleapis.com/directions/v2:computeRoutes?key={os.getenv('GOOGLE_MAPS_API_KEY')}"
                payload = {
                    "origin": {
                        "location": {
                            "latLng": {
                                "latitude": float(user["latitude"]),
                                "longitude": float(user["longitude"])
                            }
                        }
                    },
                    "destination": {
                        "location": {
                            "latLng": {
                                "latitude": float(court[3]),
                                "longitude": float(court[4])
                            }
                        }
                    },
                    "travelMode": "DRIVE",
                    "routingPreference": "TRAFFIC_AWARE_OPTIMAL"
                }
                headers = {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": os.getenv("GOOGLE_MAPS_API_KEY"),
                    "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.staticDuration"
                }
                res = requests.post(compute_url, headers=headers, json=payload)
                route_data = res.json()
                if "routes" in route_data and isinstance(route_data["routes"], list) and len(route_data["routes"]) > 0:
                    route = route_data["routes"][0]
                    distance = route.get("distanceMeters")
                    duration = route.get("duration", "0s")
                    try:
                        duration_seconds = int(duration.replace("s", ""))
                    except:
                        duration_seconds = 0

                    enriched.append({
                        "Court Name": court[1],
                        "Latitude": court[3],
                        "Longitude": court[4],
                        "distanceMeters": distance,
                        "durationSeconds": duration_seconds
                    })
            except Exception as e:
                print("test error")
                #print(court)
                print("Error processing court:", e)
                print(len(court))
    
        # already included in enriched list; no need to modify route_data directly
        sorted_distance_route_data = sorted(enriched, key=lambda x: x.get("distanceMeters", float('inf')))
        sorted_duration_route_data = sorted(enriched, key=lambda x: x.get("durationSeconds", float('inf')))
        #print("Sorted route data by distance:", sorted_distance_route_data)
        #print("Sorted route data by duration:", sorted_duration_route_data)

        #print("Route data:", enriched)
        return jsonify(sorted_distance_route_data)
        return jsonify(route_data_sorted_by_distance), jsonify(route_data_sorted_by_duration)

    except Exception as e:
        print("Routes Compute API error:", e)
        return jsonify({"error": "Error calculating distance"}), 500
    
if __name__ == "__main__":
    app.run(port=3001, debug=True)