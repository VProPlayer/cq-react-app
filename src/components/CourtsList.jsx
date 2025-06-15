import React, { useEffect, useState } from 'react'
const API_KEY = import.meta.env.GOOGLE_MAPS_API_KEY

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const hours = Array.from({ length: 18 }, (_, i) => i + 6) // 6 AM to 12 AM

function formatHour(hour) {
  if (hour === 12) return '12 PM'
  if (hour === 24) return '12 AM'
  if (hour > 12) return `${hour - 12} PM`
  return `${hour} AM`
}

export default function CourtsList() {
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('http://localhost:3001/api/data')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch court data')
        return res.json()
      })
      .then(data => {
        const formatted = data.map(court => ({
            id: court[0],
            name: court[1], 
            timing_data: court[2],
            lat: court[3],
            lng: court[4],
        }))
        console.log("formatted courts data:", formatted)
        setCourts(formatted)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error fetching courts:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Loading courts...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h2>Courts</h2>
      <table>
        <thead>
          <tr>
            <th>Court Name</th>
            <th>Court ID</th>
            <th>Timing Data</th>
            <th>Court Latitude</th>
            <th>Court Longitude</th>
          </tr>
        </thead>
        <tbody>
          {courts.map((court) => (
            <tr key={court.id}>
              <td>{court.name}</td>
              <td>{court.id}</td>
              <td>
                {Array.isArray(court.timing_data) && court.timing_data.length > 0 ? (
                  <div>
                    {court.timing_data.map((dayData, dayIndex) => (
                      <div key={`${court.id}-day-${dayIndex}`} style={{ marginBottom: '0.5rem' }}>
                        <strong>{daysOfWeek[dayIndex]}:</strong>
                        <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                          {dayData.map((value, hourIndex) => (
                            <li key={`${court.id}-day-${dayIndex}-hour-${hourIndex}`}>
                              {formatHour(hours[hourIndex])}: {value}%
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  'No timing data available'
                )}
              </td>
              <td>{court.lat}</td>
              <td>{court.lng}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
