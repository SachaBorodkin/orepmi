// server.js — Express API proxy using direct PostgreSQL pooler connection
// This bypasses Supabase RLS so we can read gps_logs directly.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'

const { Pool } = pg
const app = express()
const PORT = 3001

// Direct pooler connection from Adonis .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

app.use(cors())
app.use(express.json())

// GET /api/gps/latest — most recent GPS record
app.get('/api/gps/latest', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, latitude, longitude, speed, satellites, charge, created_at
       FROM gps_logs
       ORDER BY created_at DESC
       LIMIT 1`
    )
    if (rows.length === 0) return res.json(null)
    const row = rows[0]
    const isOnline = Date.now() - new Date(row.created_at).getTime() <= 30_000
    res.json({
      id: row.id,
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude),
      speed: parseFloat(row.speed ?? 0),
      satellites: row.satellites,
      charge: row.charge ?? 0,
      created_at: row.created_at,
      isOnline,
    })
  } catch (err) {
    console.error('[/api/gps/latest]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gps/first — very first GPS record (for "Ajouté le" date)
app.get('/api/gps/first', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT created_at FROM gps_logs ORDER BY created_at ASC LIMIT 1`
    )
    res.json(rows[0] ?? null)
  } catch (err) {
    console.error('[/api/gps/first]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gps/all — all records for history/polling
app.get('/api/gps/all', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, latitude, longitude, speed, satellites, created_at
       FROM gps_logs
       ORDER BY created_at DESC
       LIMIT 100`
    )
    res.json(rows.map(r => ({
      id: r.id,
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      speed: parseFloat(r.speed ?? 0),
      satellites: r.satellites,
      created_at: r.created_at,
    })))
  } catch (err) {
    console.error('[/api/gps/all]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/user/profile — get user by email with avatar_url
app.get('/api/user/profile', async (req, res) => {
  const email = req.query.email
  if (!email) return res.status(400).json({ error: 'Email parameter required' })

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, avatar_url, created_at, updated_at
       FROM public.users
       WHERE email = $1
       LIMIT 1`,
      [email]
    )
    res.json(rows[0] ?? null)
  } catch (err) {
    console.error('[/api/user/profile]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/user/sync-avatar — update or set avatar_url in public.users
app.post('/api/user/sync-avatar', async (req, res) => {
  const { email, avatar_url, name } = req.body
  if (!email) return res.status(400).json({ error: 'Email required' })

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.users (name, email, avatar_url, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (email) DO UPDATE SET
         avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
         name = COALESCE(EXCLUDED.name, public.users.name),
         updated_at = NOW()
       RETURNING id, name, email, avatar_url`,
      [name || email.split('@')[0], email, avatar_url || null]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('[/api/user/sync-avatar]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`[orepmi-api] Direct DB API running on http://localhost:${PORT}`)
})
