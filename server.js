// server.js — Express API proxy using direct PostgreSQL pooler connection
// This bypasses Supabase RLS so we can read gps_logs directly.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pg from 'pg'
import webpush from 'web-push'

const { Pool } = pg
const app = express()
const PORT = 3001

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BGXhG4-lvGG8PpOW0z2QV-W-UZHsdqNGaoRdbRsM3Mr-KNevKr9IF9ZDRUvk-egWZxPDwEMjf7qlsCG7zS_HxQc'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '1auH_RUF7xxcn6EaST5UnF97A_TzyWJEBFeFSPuBpJE'

try {
  webpush.setVapidDetails('mailto:contact@orepmi.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
} catch (err) {
  console.warn('[webpush vapid]', err.message)
}

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
      `SELECT id, latitude, longitude, speed, satellites, charge, tracker_id, created_at
       FROM gps_logs
       ORDER BY created_at DESC
       LIMIT 1`
    )
    if (rows.length === 0) return res.json(null)
    const row = rows[0]
    const isOnline = Date.now() - new Date(row.created_at).getTime() <= 30_000
    res.json({
      id: row.id,
      tracker_id: row.tracker_id,
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
      `SELECT created_at, tracker_id FROM gps_logs ORDER BY created_at ASC LIMIT 1`
    )
    res.json(rows[0] ?? null)
  } catch (err) {
    console.error('[/api/gps/first]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gps/all — records for history/polling
app.get('/api/gps/all', async (req, res) => {
  try {
    const trackerId = req.query.tracker_id
    let query = `SELECT id, latitude, longitude, speed, satellites, charge, tracker_id, created_at
       FROM gps_logs`
    const params = []
    if (trackerId) {
      query += ` WHERE tracker_id = $1`
      params.push(trackerId)
    }
    query += ` ORDER BY created_at DESC LIMIT 200`
    const { rows } = await pool.query(query, params)
    res.json(rows.map(r => ({
      id: r.id,
      tracker_id: r.tracker_id,
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      speed: parseFloat(r.speed ?? 0),
      satellites: r.satellites,
      charge: r.charge ?? 0,
      created_at: r.created_at,
    })))
  } catch (err) {
    console.error('[/api/gps/all]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gps/export — export all records for a tracker
app.get('/api/gps/export', async (req, res) => {
  try {
    const trackerId = req.query.tracker_id
    let query = `SELECT id, tracker_id, latitude, longitude, speed, satellites, charge, created_at
       FROM gps_logs`
    const params = []
    if (trackerId) {
      query += ` WHERE tracker_id = $1`
      params.push(trackerId)
    }
    query += ` ORDER BY created_at ASC`
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    console.error('[/api/gps/export]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tracker — get first tracker or by id
app.get('/api/tracker', async (req, res) => {
  try {
    const id = req.query.id
    let query = `SELECT id, name, locked, owner_id, created_at, updated_at FROM public.tracker ORDER BY id ASC LIMIT 1`
    let params = []
    if (id) {
      query = `SELECT id, name, locked, owner_id, created_at, updated_at FROM public.tracker WHERE id = $1 LIMIT 1`
      params = [id]
    }
    const { rows } = await pool.query(query, params)
    res.json(rows[0] ?? null)
  } catch (err) {
    console.error('[/api/tracker]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/trackers — get all trackers
app.get('/api/trackers', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, locked, owner_id, created_at, updated_at FROM public.tracker ORDER BY id ASC`
    )
    res.json(rows)
  } catch (err) {
    console.error('[/api/trackers]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/tracker/:id — update name and/or locked status
app.patch('/api/tracker/:id', async (req, res) => {
  const { id } = req.params
  const { name, locked } = req.body
  try {
    const fields = []
    const params = []
    let idx = 1

    if (name !== undefined) {
      fields.push(`name = $${idx++}`)
      params.push(name.trim())
    }
    if (locked !== undefined) {
      fields.push(`locked = $${idx++}`)
      params.push(Boolean(locked))
    }
    fields.push(`updated_at = NOW()`)
    params.push(id)

    const query = `
      UPDATE public.tracker
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, name, locked, owner_id, created_at, updated_at
    `
    const { rows } = await pool.query(query, params)
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tracker introuvable' })
    }
    res.json(rows[0])
  } catch (err) {
    console.error('[/api/tracker/:id]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tracker/rename — helper to rename tracker
app.post('/api/tracker/rename', async (req, res) => {
  const { id, name } = req.body
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' })

  try {
    let targetId = id
    if (!targetId) {
      const firstRes = await pool.query('SELECT id FROM public.tracker ORDER BY id ASC LIMIT 1')
      targetId = firstRes.rows[0]?.id
    }
    if (!targetId) return res.status(404).json({ error: 'Aucun tracker trouvé' })

    const { rows } = await pool.query(
      `UPDATE public.tracker SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, locked, owner_id, created_at, updated_at`,
      [name.trim(), targetId]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('[/api/tracker/rename]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tracker/lock — helper to update lock status
app.post('/api/tracker/lock', async (req, res) => {
  const { id, locked } = req.body
  try {
    let targetId = id
    if (!targetId) {
      const firstRes = await pool.query('SELECT id FROM public.tracker ORDER BY id ASC LIMIT 1')
      targetId = firstRes.rows[0]?.id
    }
    if (!targetId) return res.status(404).json({ error: 'Aucun tracker trouvé' })

    const { rows } = await pool.query(
      `UPDATE public.tracker SET locked = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, locked, owner_id, created_at, updated_at`,
      [Boolean(locked), targetId]
    )
    res.json(rows[0])
  } catch (err) {
    console.error('[/api/tracker/lock]', err.message)
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

// ─── Web Push Notification Endpoints ─────────────────────────────────────────
const inMemoryPushSubs = new Map()

// Ensure table exists in Postgres (fails gracefully if no permissions)
pool.query(`
  CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id SERIAL PRIMARY KEY,
    endpoint TEXT UNIQUE NOT NULL,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )
`).catch(err => {
  console.warn('[push_subscriptions table notice]', err.message)
})

// GET /api/push/vapid-public-key — return public VAPID key to browser
app.get('/api/push/vapid-public-key', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY })
})

// POST /api/push/subscribe — register device push subscription
app.post('/api/push/subscribe', async (req, res) => {
  const subscription = req.body
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription is missing or invalid' })
  }

  inMemoryPushSubs.set(subscription.endpoint, subscription)

  try {
    await pool.query(
      `INSERT INTO public.push_subscriptions (endpoint, subscription)
       VALUES ($1, $2)
       ON CONFLICT (endpoint) DO UPDATE SET subscription = $2`,
      [subscription.endpoint, JSON.stringify(subscription)]
    )
  } catch (err) {
    console.warn('[save push_subscription to db failed, saved in memory]', err.message)
  }

  res.json({ success: true, count: inMemoryPushSubs.size })
})

// POST /api/push/send — broadcast push notification to registered devices (phone/browser)
app.post('/api/push/send', async (req, res) => {
  const { title, body, icon, url, tag } = req.body || {}
  const payload = JSON.stringify({
    title: title || 'Orepmi — Alerte',
    body: body || 'Notification du tracker',
    icon: icon || '/assets/images/logos/logo_without_name.png',
    badge: '/assets/images/logos/logo_without_name.png',
    url: url || '/',
    tag: tag || 'orepmi-alert',
  })

  let subs = []
  try {
    const { rows } = await pool.query('SELECT endpoint, subscription FROM public.push_subscriptions')
    if (rows && rows.length > 0) {
      subs = rows.map(r => typeof r.subscription === 'string' ? JSON.parse(r.subscription) : r.subscription)
    }
  } catch {
    // DB failed, use memory
  }

  // Merge with memory subscriptions
  for (const [endpoint, sub] of inMemoryPushSubs.entries()) {
    if (!subs.some(s => s.endpoint === endpoint)) {
      subs.push(sub)
    }
  }

  if (subs.length === 0) {
    return res.json({ sent: 0, total: 0, message: 'No registered push devices yet' })
  }

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload)
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          inMemoryPushSubs.delete(sub.endpoint)
          try {
            await pool.query('DELETE FROM public.push_subscriptions WHERE endpoint = $1', [sub.endpoint])
          } catch {}
        }
        throw err
      }
    })
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  res.json({ sent, total: subs.length })
})

app.listen(PORT, () => {
  console.log(`[orepmi-api] Direct DB API running on http://localhost:${PORT}`)
})
