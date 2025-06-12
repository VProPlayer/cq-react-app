import React, { useEffect, useState } from 'react'

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const hours = Array.from({ length: 18 }, (_, i) => i + 6) // 6 AM to 12 AM

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function formatHour(hour) {
  if (hour === 12) return '12 PM'
  if (hour === 24) return '12 AM'
  if (hour > 12) return `${hour - 12} PM`
  return `${hour} AM`
}

const getCoordinatesFromCourtNames = async (courtNames, API_KEY) => {
  const results = []

  for (const name of courtNames) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(name)}&key=${API_KEY}`
    const res = await fetch(url)
    const json = await res.json()
    if (json.status === 'OK') {
      const { lat, lng } = json.results[0].geometry.location
      results.push({ name, lat, lng })
    } else {
      console.warn(`Could not geocode: ${name}`, json.status)
    }
  }

  return results
}

const getClosestCourtByTravelTime = async (userLocation, courtCoords) => {
  try {
    const res = await fetch('http://localhost:3001/api/closest-court', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userLocation, courtCoords }),
    })

    const json = await res.json()
    if (json.status !== 'OK') {
      console.error("Distance Matrix API error:", json)
      return null
    }

    const times = json.rows[0].elements
    const minIndex = times.reduce((minIdx, el, i, arr) =>
      el.status === 'OK' && (arr[minIdx]?.duration_in_traffic?.value ?? Infinity) > el.duration_in_traffic.value
        ? i
        : minIdx, 0)

    return courtCoords[minIndex]
  } catch (error) {
    console.error("Error calling backend:", error)
    return null
  }
}
// run api once in the beginning to get lat/lng in future
function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [closestCourt, setClosestCourt] = useState(null)


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
    if (data && userLocation) {
      console.log("Raw data from DB:", data)
      const courtNames = data.map(court => court.COURTS)
      console.log("Court names:", courtNames)
      getCoordinatesFromCourtNames(courtNames, API_KEY).then(courtCoords => {
        console.log('Court Coordinates:', courtCoords)

         getClosestCourtByTravelTime(userLocation, courtCoords).then(court => {
        if (court) {
          console.log("Closest Court:", court)
          setClosestCourt(court)
        }
      })
      })
     
    }
  }, [data, userLocation])

  useEffect(() => {
    fetch('http://localhost:3001/api/data')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <p>Loading data...</p>
  if (error) return <p>Error loading data: {error}</p>

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Courts Availability</h1>

      {closestCourt && (
        <div style={{ marginBottom: '1rem', fontSize: '1.2rem', fontWeight: 'bold', color: 'green' }}>
          Closest court (by traffic): {closestCourt}
        </div>
      )}

      {data && data.length > 0 ? (
        data.map(({ COURTS, "TIMING DATA": timingData }, courtIdx) => (
          <div key={courtIdx} style={{ marginBottom: '3rem' }}>
            <h2>{COURTS}</h2>
            {timingData && Array.isArray(timingData) ? (
              <table border="1" cellPadding="6" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Hour</th>
                    <th>Availability (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {daysOfWeek.map((day, dayIdx) => {
                    const dayData = timingData[dayIdx] || []
                    return hours.map((hour, hourIdx) => (
                      <tr key={`${day}-${hour}`}>
                        {/* Show day once per day (rowSpan) */}
                        {hourIdx === 0 && (
                          <td rowSpan={hours.length} style={{ verticalAlign: 'middle', fontWeight: 'bold' }}>
                            {day}
                          </td>
                        )}
                        <td>{formatHour(hour)}</td>
                        <td>{dayData[hourIdx] !== undefined ? dayData[hourIdx] : 'N/A'}</td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            ) : (
              <p>No timing data available</p>
            )}
          </div>
        ))
      ) : (
        <p>No court data found</p>
      )}
    </div>
  )
  // (
  //   <div style={{ padding: '1rem' }}>
  //     <h1>Data from Database</h1>
  //     <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
  //       {JSON.stringify(data, null, 2)}
  //     </pre>
  //   </div>
  // )
}

export default App