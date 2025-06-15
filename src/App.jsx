import React, { useEffect, useState } from 'react';
import CourtsList from "./components/CourtsList";


const API_KEY = import.meta.env.GOOGLE_MAPS_API_KEY

function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)


  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords
          setUserLocation({ latitude, longitude })
        },
        error => {
          console.error("Error getting user location:", error)
        }
      )
    } else {
      console.error("Geolocation is not supported by this browser.")
    }
  }, [])

  useEffect(() => {
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
      <h1>Tennis Court Availability</h1>
      {data && <CourtsList courts={data} />}
    </div>
  )
}

export default App