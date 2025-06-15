import express from 'express'
import { Pool } from 'pg'
import cors from 'cors'
import dotenv from 'dotenv'


dotenv.config({path: './.env'})

const app = express()
app.use(cors())
app.use(express.json())

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

app.get('/api/data', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM court_busy_data')
    res.json(result.rows)
  } catch (err) {
    console.error('Database error:', err)
    res.status(500).send('Error fetching data from database')
  }
})

app.post('/api/closest-court', async (req, res) => {
  try {
    const { userLocation, courtCoords } = req.body
    const destinations = courtCoords.map(c => `${c.lat},${c.lng}`).join('|')
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${userLocation.latitude},${userLocation.longitude}&destinations=${destinations}&departure_time=now&traffic_model=best_guess&key=${process.env.GOOGLE_MAPS_API_KEY}`

    console.log("Requesting matrix with URL", url)
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Error fetching distance matrix:', error)
    res.status(500).send('Error processing closest court request')
  }
})

app.post('/api/geocode-courts', async (req, res) => {
  try {
    const { courtNames } = req.body
    console.log("Received courtNames from frontend:", courtNames)
    const results = []

    for (const name of courtNames) {
      const query = `${name}, North Carolina`
      let geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      console.log(`Trying Geocode API: ${geocodeUrl}`)
      // First try: Geocoding API
      
      let response = await fetch(geocodeUrl)
      let json = await response.json()

      if (json.status === 'OK') {
        const { lat, lng } = json.results[0].geometry.location
        results.push({ name, lat, lng })
        continue
      }

      // Fallback: Places Text Search API
      console.warn(`Geocode failed for ${name}, status: ${json.status}, fallback to Places API`)
      let placeUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      console.log(`Trying Places API: ${placeUrl}`)
      response = await fetch(placeUrl)
      json = await response.json()

      if (json.status === 'OK') {
        const { lat, lng } = json.results[0].geometry.location
        results.push({ name, lat, lng })
      } else {
        console.warn(`Could not geocode: ${name} → ${json.status}`)
      }
    }
    console.log("Final geocoded results:", results)
    res.json(results)
  } catch (error) {
    console.error('Geocoding route error:', error)
    res.status(500).send('Error geocoding court names')
  }
})
app.listen(3001, () => {
  console.log('Server running on http://localhost:3001')
})