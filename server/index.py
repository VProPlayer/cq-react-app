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
                print("Route data received:", route_data)

            
                #print("Type of route_data:", type(route_data))


        #         if "routes" in route_data and route_data["routes"]:
        #             route = route_data["routes"][0]

        #             distance_value = route.get("distanceMeters")
        #             duration_str = route.get("duration", "0s")
        #             static_duration_str = route.get("staticDuration", "0s")
        #             description = route.get("description", "")

        #             try:
        #                 duration_value = int(duration_str.replace("s", ""))
        #             except Exception:
        #                 duration_value = 0

        #             try:
        #                 static_duration_value = int(static_duration_str.replace("s", ""))
        #             except Exception:
        #                 static_duration_value = 0

        #             enriched.append({
        #                 **court,
        #                 "distance_value": distance_value,
        #                 "duration_value": duration_value,
        #                 "static_duration_value": static_duration_value,
        #                 "description": description
        #             })
        #         else:
        #             enriched.append({
        #                 **court,
        #                 "distance_value": None,
        #                 "duration_value": None,
        #                 "static_duration_value": None,
        #                 "description": None
        #             })
            except Exception as e:
                print("test error")
                #print(court)
                print("Error processing court:", e)
                print(len(court))
                #print(f"Error processing court {court.get('name', 'unknown')}: {e}")
                # enriched.append({
                #     **court,
                #     "distance_value": None,
                #     "duration_value": None,
                #     "static_duration_value": None,
                #     "description": None
                # })

        return jsonify(route_data)
    except Exception as e:
        print("Routes Compute API error:", e)
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