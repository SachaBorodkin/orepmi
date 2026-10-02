<template>
  <!-- Fullscreen overlay -->
  <Teleport to="body">
    <Transition name="fs-fade">
      <div v-if="fullscreen" class="map-fullscreen-overlay" @keydown.escape="closeFullscreen" tabindex="-1">
        <div class="map-fullscreen-card">
          <div ref="fullscreenMapEl" class="map-fullscreen-container"></div>
          <button class="map-fullscreen-close" @click="closeFullscreen" title="Fermer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div v-if="location" class="map-fullscreen-coords">
            {{ location.lat.toFixed(5) }}°N, {{ location.lng.toFixed(5) }}°E
            <span :class="['fs-dot', isOnline ? 'online' : 'offline']"></span>
            {{ isOnline ? 'EN LIGNE' : 'HORS LIGNE' }}
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <div class="tracker-card">
    <!-- Map area -->
    <div class="tracker-map-wrapper">
      <div v-if="location" ref="mapEl" class="tracker-map-live"></div>
      <div v-else class="tracker-map-live tracker-map-empty">
        <div class="map-empty-inner">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); margin-bottom:8px">
            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <span>Aucune donnée GPS</span>
        </div>
      </div>

      <!-- Fullscreen button -->
      <button v-if="location" class="map-expand-btn" @click="openFullscreen" title="Plein écran">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      </button>
    </div>

    <div class="tracker-card-body">

      <!-- Row 1: Name — Batterie -->
      <div class="tracker-name-battery">
        <span class="tracker-name">{{ trackerName }}</span>
        <span class="tracker-sep"> — </span>
        <span class="tracker-battery-label">Batterie du tracker:</span>
        <span class="tracker-battery" :style="batteryColor">{{ battery }}%</span>
      </div>

      <!-- Row 2: Added date -->
      <div class="tracker-added-date">
        <span v-if="firstRecordDate">Ajouté le {{ formatLongDate(firstRecordDate) }}</span>
        <span v-else>Aucune donnée</span>
      </div>

      <!-- Divider -->
      <div class="card-divider"></div>

      <!-- Row 3: Lock status — movement -->
      <div class="tracker-status">
        <span :style="{ color: isLocked ? '#fca5a5' : 'var(--accent-green)', fontWeight: 700 }">
          {{ isLocked ? 'VERROUILLÉ' : 'DÉVERROUILLÉ' }}
        </span>
        <span style="color: var(--text-secondary)"> — </span>
        <span style="color: var(--text-secondary)">
          {{ isOnline ? 'En mouvement' : 'Pas de mouvement' }}
        </span>
        <span
          v-if="movementDetected && isLocked"
          class="movement-label"
        > 🚨</span>
      </div>

      <!-- Buttons -->
      <div class="tracker-actions">
        <button
          class="btn-card-white"
          @click="toggleLock"
        >{{ isLocked ? 'Déverrouiller' : 'Verrouiller' }}</button>

        <button class="btn-card-danger" @click="confirmDelete">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          Supprimer
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { supabase } from '../lib/supabase'

// ─── State ────────────────────────────────────────────────────────────────────
const location        = ref(null)   // latest GPS row
const firstRecordDate = ref(null)   // oldest GPS row created_at
const lastMovementDate = ref(null)  // when the tracker last meaningfully moved
const movementDetected = ref(false) // new movement since last poll
const isLocked        = ref(true)   // true = alert on movement, false = owner moving
const trackerName     = ref('TestTracker1')

const mapEl           = ref(null)
const fullscreenMapEl = ref(null)
const fullscreen      = ref(false)

let map          = null
let marker       = null
let fsMap        = null
let fsMarker     = null
let pollInterval = null
let realtimeChannel = null

// Previous position snapshot for movement detection (2nd decimal precision)
let prevLat = null
let prevLng = null

// ─── Computed ─────────────────────────────────────────────────────────────────
const isOnline = computed(() => {
  if (!location.value) return false
  const delta = Date.now() - new Date(location.value.created_at).getTime()
  return location.value.isOnline ?? delta <= 30_000
})

// Battery from DB charge column (null → 0)
const battery = computed(() => location.value?.charge ?? 0)

const batteryColor = computed(() => {
  const b = battery.value
  if (b >= 80) return { color: '#22C55E', fontWeight: 700 } // Emerald Green
  if (b >= 60) return { color: '#84CC16', fontWeight: 700 } // Lime Green
  if (b >= 40) return { color: '#F59E0B', fontWeight: 700 } // Amber/Yellow
  if (b >= 20) return { color: '#F97316', fontWeight: 700 } // Orange
  if (b >= 10) return { color: '#EF4444', fontWeight: 700 } // Red
  return { color: '#B91C1C', fontWeight: 700 }              // Deep Red (0–9%)
})

// ─── Movement detection (same logic as Adonis tracker-map.js) ─────────────────
function fmt2(val) {
  return typeof val === 'number' ? val.toFixed(2) : ''
}

function hasMoved(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return false
  return fmt2(lat1) !== fmt2(lat2) || fmt2(lng1) !== fmt2(lng2)
}

// ─── Fetch GPS data (Supabase direct + API fallback) ──────────────────────────
async function fetchLatest() {
  try {
    let data = null

    // 1. Direct Supabase query (works in production on Vercel and localhost)
    const { data: supaRows, error } = await supabase
      .from('gps_logs')
      .select('id, latitude, longitude, speed, satellites, charge, created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!error && supaRows && supaRows.length > 0) {
      const row = supaRows[0]
      const isOnline = Date.now() - new Date(row.created_at).getTime() <= 30_000
      data = {
        id: row.id,
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude),
        speed: parseFloat(row.speed ?? 0),
        satellites: row.satellites,
        charge: row.charge ?? 0,
        created_at: row.created_at,
        isOnline,
      }
    } else {
      // 2. Fallback to /api/gps/latest if running local Express proxy
      try {
        const res = await fetch('/api/gps/latest')
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          data = await res.json()
        }
      } catch { /* ignore fallback error */ }
    }

    if (!data) return

    const prev = location.value
    location.value = data

    // Detect movement (2nd decimal changed)
    if (hasMoved(prevLat, prevLng, data.lat, data.lng)) {
      lastMovementDate.value = data.created_at

      if (prevLat !== null) {
        // Only fire alert if tracker is locked (not owner movement)
        if (isLocked.value) {
          movementDetected.value = true
          showMovementAlert(data.lat, data.lng)
        } else {
          // Owner is moving — record silently, no alert
          movementDetected.value = true
        }
      }
    }

    prevLat = data.lat
    prevLng = data.lng

    // Update map markers
    if (map && marker && prev) {
      const latlng = [data.lat, data.lng]
      marker.setLatLng(latlng)
      map.panTo(latlng)
    }
    if (fsMap && fsMarker) {
      const latlng = [data.lat, data.lng]
      fsMarker.setLatLng(latlng)
      fsMap.panTo(latlng)
    }
  } catch (err) {
    console.error('[fetchLatest]', err)
  }
}

async function fetchFirstRecord() {
  try {
    // 1. Direct Supabase query
    const { data: firstRows, error } = await supabase
      .from('gps_logs')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)

    if (!error && firstRows && firstRows.length > 0) {
      firstRecordDate.value = firstRows[0].created_at
      if (!lastMovementDate.value) lastMovementDate.value = firstRows[0].created_at
      return
    }

    // 2. Fallback to /api/gps/first
    try {
      const res = await fetch('/api/gps/first')
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const d = await res.json()
        if (d?.created_at) {
          firstRecordDate.value = d.created_at
          if (!lastMovementDate.value) lastMovementDate.value = d.created_at
        }
      }
    } catch { /* ignore fallback error */ }
  } catch (err) {
    console.error('[fetchFirstRecord]', err)
  }
}

// ─── Alert (browser notification + console) ───────────────────────────────────
function showMovementAlert(lat, lng) {
  const msg = `🚨 Mouvement détecté — nouvelle position (${lat.toFixed(4)}, ${lng.toFixed(4)})`
  console.warn('[orepmi]', msg)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Tracker Orepmi — Mouvement détecté', {
        body: msg,
        icon: '/assets/images/logos/logo_without_name.png',
      })
    } catch { /* ignore */ }
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function formatLongDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatRelative(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `il y a ${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH}h`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ─── Leaflet ──────────────────────────────────────────────────────────────────
async function buildMap(el, lat, lng) {
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  const m = L.map(el, { zoomControl: true, attributionControl: true }).setView([lat, lng], 15)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(m)

  const pinIcon = L.divIcon({
    className: '',
    html: '<div class="map-marker-pin"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })

  const mk = L.marker([lat, lng], { icon: pinIcon }).addTo(m)
  setTimeout(() => m.invalidateSize(), 100)
  return { map: m, marker: mk }
}

async function initMap() {
  if (!mapEl.value || !location.value) return
  const { map: m, marker: mk } = await buildMap(mapEl.value, location.value.lat, location.value.lng)
  map = m
  marker = mk
}

// ─── Fullscreen ───────────────────────────────────────────────────────────────
async function openFullscreen() {
  fullscreen.value = true
  document.body.classList.add('map-fullscreen-active')
  await nextTick()
  if (fullscreenMapEl.value && location.value) {
    const { map: m, marker: mk } = await buildMap(
      fullscreenMapEl.value, location.value.lat, location.value.lng
    )
    fsMap = m
    fsMarker = mk
    setTimeout(() => {
      if (fsMap) fsMap.invalidateSize()
    }, 150)
  }
}

function closeFullscreen() {
  fullscreen.value = false
  document.body.classList.remove('map-fullscreen-active')
  if (fsMap) { fsMap.remove(); fsMap = null; fsMarker = null }
}

// ─── Lock toggle ──────────────────────────────────────────────────────────────
function toggleLock() {
  isLocked.value = !isLocked.value
  // When locking again, reset movement flag so next real move triggers fresh alert
  if (isLocked.value) movementDetected.value = false
}

function confirmDelete() {
  if (confirm('Supprimer ce tracker ? (test — aucune donnée ne sera effacée)')) {
    alert('Suppression simulée.')
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchLatest()
  await fetchFirstRecord()
  if (location.value) await initMap()
  // Poll every 10 s
  pollInterval = setInterval(fetchLatest, 10_000)

  // Realtime subscription for immediate position updates
  realtimeChannel = supabase
    .channel('gps_logs_card')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gps_logs' }, () => {
      fetchLatest()
    })
    .subscribe()

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
})

onUnmounted(() => {
  clearInterval(pollInterval)
  if (realtimeChannel) realtimeChannel.unsubscribe()
  document.body.classList.remove('map-fullscreen-active')
  if (map) map.remove()
  if (fsMap) fsMap.remove()
})

watch(location, async (newVal) => {
  if (newVal && !map) await initMap()
})
</script>

<style scoped>
/* Map wrapper */
.tracker-map-wrapper { position: relative; }

/* Tracker name */
.tracker-card-name {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.01em;
  margin-bottom: 10px;
}

.map-expand-btn {
  position: absolute;
  top: 8px; right: 8px;
  z-index: 10;
  background: rgba(12, 16, 20, 0.82);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  color: #fff;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease;
  backdrop-filter: blur(4px);
}
.map-expand-btn:hover { background: rgba(30, 40, 50, 0.95); }

/* Fullscreen */
.map-fullscreen-overlay {
  position: fixed;
  top: 68px; /* Below site header */
  bottom: 53px; /* Above site footer */
  left: 0;
  right: 0;
  z-index: 80;
  background: rgba(12, 16, 20, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: 24px 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  outline: none;
}

.map-fullscreen-card {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 1200px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08);
  background: #0b0f13;
}

.map-fullscreen-container {
  width: 100%;
  height: 100%;
}

.map-fullscreen-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 1010;
  background: rgba(12, 16, 20, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #fff;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(6px);
}
.map-fullscreen-close:hover {
  background: rgba(220, 38, 38, 0.7);
  border-color: rgba(220, 38, 38, 0.9);
}

.map-fullscreen-coords {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1010;
  background: rgba(12, 16, 20, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 7px 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 10px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}
.fs-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.fs-dot.online  { background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green); }
.fs-dot.offline { background: var(--text-muted); }

/* Fullscreen transitions */
.fs-fade-enter-active,
.fs-fade-leave-active {
  transition: opacity 0.22s ease;
}
.fs-fade-enter-from,
.fs-fade-leave-to {
  opacity: 0;
}
.fs-fade-enter-active .map-fullscreen-card,
.fs-fade-leave-active .map-fullscreen-card {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.fs-fade-enter-from .map-fullscreen-card,
.fs-fade-leave-to .map-fullscreen-card {
  transform: scale(0.97) translateY(8px);
}

/* Empty map */
.map-empty-inner {
  display: flex; flex-direction: column; align-items: center;
  color: var(--text-muted); font-size: 13px;
}

/* Status row (EN LIGNE + lock badge) */
.tracker-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.tracker-status {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot-online  {
  background: var(--accent-green);
  box-shadow: 0 0 5px var(--accent-green);
  animation: dot-blink 2s ease-in-out infinite;
}
.dot-offline { background: var(--text-muted); }
@keyframes dot-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

/* Lock badge */
.lock-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase;
  padding: 3px 8px; border-radius: 4px;
}
.lock-badge.locked {
  background: rgba(185, 28, 28, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.35);
  color: #fca5a5;
}
.lock-badge.unlocked {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: var(--accent-green);
}

/* Meta rows (date + last movement) */
.tracker-meta-row {
  display: flex; align-items: center; gap: 7px;
  font-size: 11px; color: var(--text-muted);
  margin-bottom: 6px;
}
.tracker-meta-row.movement-alert {
  color: #fca5a5;
  animation: alert-flash 0.6s ease;
}
@keyframes alert-flash {
  0%, 100% { opacity: 1; } 50% { opacity: 0.5; }
}
.movement-label {
  color: #fca5a5; font-weight: 600;
}
.movement-owner-label {
  color: var(--accent-orange); font-weight: 600; opacity: 0.75;
}

/* Divider */
.card-divider {
  height: 1px; background: var(--border-color);
  margin: 12px 0;
}

/* Unlocked notice */
.unlocked-notice {
  display: flex; align-items: center; gap: 7px;
  font-size: 11px; color: var(--accent-green);
  background: rgba(34, 197, 94, 0.06);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 4px; padding: 7px 10px;
  margin-bottom: 12px;
  line-height: 1.4;
}

/* Lock / Unlock button */
.btn-lock {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; font-size: 12px; font-weight: 700;
  padding: 7px 10px; border-radius: 4px; border: none;
  cursor: pointer; transition: all 0.2s ease;
  text-align: center;
}
.btn-lock-locked {
  background: rgba(185, 28, 28, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.35);
  color: #fca5a5;
}
.btn-lock-locked:hover {
  background: rgba(185, 28, 28, 0.2);
  border-color: #dc2626;
  color: #fff;
}
.btn-lock-unlocked {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: var(--accent-green);
}
.btn-lock-unlocked:hover {
  background: rgba(34, 197, 94, 0.22);
}
</style>
