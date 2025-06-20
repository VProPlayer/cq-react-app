import React, { useEffect, useState } from 'react';
import CourtsList from "./components/CourtsList";
import { GoogleMap, LoadScript } from '@react-google-maps/api';
//import './App.css'


const API_KEY = import.meta.env.GOOGLE_MAPS_API_KEY

const containerStyle = {
  width: '100vh',
  height: '100vh',
  position: 'absolute',
  top: 0,
  left: 0,
  zIndex: -1,
};

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [screen, setScreen] = useState("splash");


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
    setUserLocation({ latitude: num, longitude: -num });
  }
}, []);

  useEffect(() => {
    // if(!loading){
    //   // make sure the splashscreen doesn't show when done loading
    //   const timeout = setTimeout(() => setScreen("main"),1000);
    //   return clearTimeout(timeout);
    // }
    if (!userLocation) return;

    // Fetch court data with lat/lng
    fetch("http://localhost:3001/api/data")
      .then(res => res.json())
      .then(rawCourts => {
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
          .then(enriched => {
            setData(enriched)
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
  }, [userLocation])
  
  return (
    <div>
      {/* {data && <CourtsList courts={data} />} */}
      <button>Start Your Quest</button>
    </div>


  )
}

function SplashScreen(){
  const center = {
    lat: 40.712,
    lng: -74.006
  };

  return(
    <div style={{position: "relative", height: "100vh"}}>
    <LoadScript googleMapsApiKey={API_KEY}>
      <GoogleMap
      // mapContainerClassName={containerStyle}
      center={center}
      zoom={12}
      >
      </GoogleMap>  
    </LoadScript>

    </div>
  )
};

export default App