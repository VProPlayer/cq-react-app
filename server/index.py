from flask import Flask, request, jsonify
import psycopg2
import os
from dotenv import load_dotenv
import requests
from flask_cors import CORS
from datetime import datetime

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
                        "timing": court[2],
                        "distanceMeters": distance,
                        "durationSeconds": duration_seconds
                    })
            except Exception as e:
                # print("test error")
                #print(court)
                print("Error processing court:", e)
                print(len(court))
    
        # already included in enriched list; no need to modify route_data directly
        sorted_distance_route_data = sorted(enriched, key=lambda x: x.get("distanceMeters", float('inf')))
        sorted_duration_route_data = sorted(enriched, key=lambda x: x.get("durationSeconds", float('inf')))
        #print("Sorted route data by distance:", sorted_distance_route_data)
        #print("Sorted route data by duration:", sorted_duration_route_data)
        # Run the algorithm to get the recommended court
        recommended_courts = algorithm(sorted_duration_route_data)
        print("Recommended courts:", recommended_courts)

        #print("Route data:", enriched)
        return jsonify(sorted_duration_route_data, recommended_courts)

    except Exception as e:
        print("Routes Compute API error:", e)
        return jsonify({"error": "Error calculating distance"}), 500
    

def algorithm(sorted_duration_route_data):
    # Get top 3 fastest courts by duration
    top_3_duration = sorted_duration_route_data[:3]

    current_hour = datetime.now().hour - 6  # Convert to 0–17 index (6 AM to 11 PM)
    if current_hour < 0 or current_hour >= 18:
        return {"message": "Outside of tracking hours"
                } 
        # add closest court as a return
    def get_busyness(court):
        timing_data = court.get("timing")
        if isinstance(timing_data, list) and len(timing_data) > 0:
            today = (datetime.today().weekday() + 1) % 7  # Sunday = 0, Monday = 1
            #print(timing_data)
            day_data = timing_data[today]
            if current_hour < len(day_data):
                return day_data[current_hour]
        return 100  # If something goes wrong, assume it's 100% busy

    fastest = top_3_duration[0]
    second_fastest = top_3_duration[1]
    third_fastest = top_3_duration[2]

    # Find the court with the lowest busyness
    courts_with_busyness = [
        {"court": fastest, "busyness": get_busyness(fastest)},
        {"court": second_fastest, "busyness": get_busyness(second_fastest)},
        {"court": third_fastest, "busyness": get_busyness(third_fastest)},
    ]
    least_busy = min(courts_with_busyness, key=lambda x: x["busyness"])
    # debug
    # print("Court object (fastest):", fastest)
    # print("Court object (least busy):", least_busy["court"])
    # print("Fastest court name:", fastest.get("Court Name"))
    # print("Least busy court name:", least_busy["court"].get("Court Name"))
    # print("Second fastest court name:", second_fastest.get("Court Name"))
    # print("Second fastest court busyness:", get_busyness(second_fastest))
    # print("Third fastest court name:", third_fastest.get("Court Name"))
    # print("Third fastest court busyness:", get_busyness(third_fastest))
    # print("Timing data (closest):", closest.get("timing"))
    # print("Timing data (fastest):", fastest.get("timing"))
    # # Busyness values for the fastest and least busy courts at current time (debugging)
    # busy_fastest = get_busyness(fastest)
    # busy_least = get_busyness(least_busy["court"])
    return {
        # "recommended": fastest,
        "fastest": fastest.get("Court Name"),
        "least_busy": least_busy["court"].get("Court Name"),
        # "busy_fastest": busy_fastest,
        # "busy_least": busy_least
    }


if __name__ == "__main__":
    app.run(port=3001, debug=True)