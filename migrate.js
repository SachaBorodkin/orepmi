import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await pool.query('ALTER TABLE gps_logs ADD COLUMN IF NOT EXISTS charge SMALLINT DEFAULT NULL')
  console.log('✓ Column "charge" added to gps_logs (or already exists)')
} catch (err) {
  console.error('✗', err.message)
} finally {
  await pool.end()
}
