import express from 'express'
import { Pool } from 'pg'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())

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

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001')
})