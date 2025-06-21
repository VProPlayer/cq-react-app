import React, { useEffect, useState, useRef } from 'react';
import CourtsList from "./components/CourtsList";
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import {createRoot} from "react-dom/client";
//import { GoogleMap, LoadScript } from '@react-google-maps/api';
import './App.css'


const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const containerStyle = {
  width: '100vw',
  height: '100vh',
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: -1,
};

// const startButtonWrapperStyle = {
//   position: 'fixed',
//   bottom: '130px',
//   left: '50%',
//   transform: 'translateX(-50%)',
//   zIndex: 10,
// };

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const[recommendedCourt, setRecommendedCourt] = useState(null)
  const [screen, setScreen] = useState("splash");
  const mapRef = useRef(null);

useEffect(() => {
  // Toggle between geolocation and custom coordinates
  // Getting data from backend basically KK

  // Option 1: Use geolocation (default)
  const useGeolocation = true;

  if (useGeolocation && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ latitude, longitude });
      },
      error => {
        console.error("Error getting user location:", error);
      }
    );
  } else {
    // Option 2: Use custom coordinates (uncomment and set your values)
    setUserLocation({ latitude: 35.822012, longitude: -78.858422 });
  }
}, []);

useEffect(() => {
  console.log("🔥 fitBounds effect firing");
  console.log("userLocation:", userLocation);
  console.log("recommendedCourt:", recommendedCourt);
  console.log("mapRef.current:", mapRef.current);

console.log("Keys of mapRef.current:", Object.keys(mapRef.current || {}));
console.log("Type of mapRef.current.fitBounds:", typeof mapRef.current?.fitBounds);
console.log("mapRef.current.constructor.name:", mapRef.current?.constructor?.name);
  if (!mapRef.current || !userLocation || !recommendedCourt) return;

  const bounds = new window.google.maps.LatLngBounds();

  bounds.extend(new window.google.maps.LatLng(userLocation.latitude, userLocation.longitude));
  bounds.extend(new window.google.maps.LatLng(recommendedCourt.fastest.Latitude, recommendedCourt.fastest.Longitude));
  bounds.extend(new window.google.maps.LatLng(recommendedCourt.least_busy.Latitude, recommendedCourt.least_busy.Longitude));

  const center = bounds.getCenter();

  // Smoothly pan to the center
  mapRef.current.panTo(center);
  console.log("Map instance:", mapRef.current);
  console.log("Bounds object:", bounds);


  setTimeout(() => {
  if (typeof mapRef.current?.fitBounds === 'function') {
    console.log("✅ fitBounds called");
    mapRef.current.fitBounds(bounds);
  }
}, 100);
}, [userLocation, recommendedCourt, mapRef.current]);

  useEffect(() => {
    if (screen !== "main") return;
    if (!userLocation) return;

    // Fetch court data with lat/lng
  fetch("http://localhost:3001/api/data")
    .then(res => res.json())
    .then(rawCourts => {
      //console.log("Raw courts data:", rawCourts) -- debugging line
      // Call backend to enrich with distance and duration
      fetch("http://localhost:3001/api/closest-court", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userLocation,
          courts: rawCourts
        })
      })
        .then(res => res.json())
        .then(response => {
          setData(response[0])
          // console.log("Enriched courts data:", enriched)
          setRecommendedCourt(response[1])
          setLoading(false)
        })
        .catch(err => {
          console.error("Error calling /api/closest-court:", err)
          setError("Failed to load closest court info")
          setLoading(false)
        })
    })
    .catch(err => {
      console.error("Error loading courts:", err)
      setError("Failed to load court data")
      setLoading(false)
    })
}, [userLocation, screen])
  
  // Handler for GoogleMap onLoad event
  const onLoad = (map) => {
    mapRef.current = map;
    console.log("✅ GoogleMap onLoad, ref set.");
  };

  return (
    <LoadScript googleMapsApiKey={API_KEY} onLoad={() => console.log('Maps API has loaded.')}>
      <div>
        {userLocation && (
          <div className="map-container">
            <GoogleMap
              mapContainerStyle={containerStyle}
              zoom={18}
              center={{ lat: userLocation.latitude, lng: userLocation.longitude }}
              onLoad={onLoad}
              options={{
                disableDefaultUI: true,
                zoomControl: false,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
              }}
            >
              <Marker 
                position={{ lat: userLocation.latitude, lng: userLocation.longitude }} 
                icon={{
                  url: '/blue-pulse.svg',
                  scaledSize: new window.google.maps.Size(40, 40),
                  anchor: new window.google.maps.Point(20, 20),
                }}
              />
              {recommendedCourt && (
                <>
                  <Marker
                    position={{
                      lat: recommendedCourt.fastest.Latitude,
                      lng: recommendedCourt.fastest.Longitude,
                    }}
                    title={`Closest: ${recommendedCourt.fastest["Court Name"]}`}
                    label="Closest Court"
                    icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png"
                  />
                  <Marker
                    position={{
                      lat: recommendedCourt.least_busy.Latitude,
                      lng: recommendedCourt.least_busy.Longitude,
                    }}
                    title={`Recommended: ${recommendedCourt.least_busy["Court Name"]}`}
                    label="Recommended Court"
                    icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                  />
                </>
              )}
            </GoogleMap>
          </div>
        )}
  <div className="start-button-wrapper">
    <button className="glassy-button" onClick={() => setScreen("main")}>Start Your Quest</button>
  </div>
      </div>
    </LoadScript>
  )
}


// Optionally, move SplashScreen outside if you plan to use it elsewhere
// function SplashScreen(){
//   const center = {
//     lat: 40.712,
//     lng: -74.006
//   };

//   return(
//     <div style={{position: "relative", height: "100vh"}}>
//     <LoadScript googleMapsApiKey={API_KEY}>
//       <GoogleMap
//       // mapContainerClassName={containerStyle}
//       center={center}
//       zoom={12}
//       >
//       </GoogleMap>  
//     </LoadScript>

//     </div>
//   )
// }

export default App