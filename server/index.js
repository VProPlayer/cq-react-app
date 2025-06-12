import express from 'express'
import { Pool } from 'pg'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config({path: './.env-backend'})

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

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001')
})