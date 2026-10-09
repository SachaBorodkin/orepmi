<template>
  <div class="trajectory-page">
    <div class="trajectory-container">
      <!-- Page Header -->
      <header class="trajectory-header">
        <div class="header-left">
          <div class="page-badge">
            <span class="badge-dot"></span>
            HISTORIQUE DES PARCOURS & TRAJETS
          </div>
          <h1 class="page-title">Tracé du parcours par date</h1>
          <p class="page-subtitle">
            Visualisez et analysez chaque itinéraire emprunté par votre tracker à partir des données GPS enregistrées.
          </p>
        </div>

        <!-- Tracker Selector / Status -->
        <div class="header-right">
          <div class="tracker-chip">
            <span class="tracker-chip-dot"></span>
            <span class="tracker-chip-name">{{ trackerName }} (ID: {{ trackerId }})</span>
            <span v-if="latestLocation" class="tracker-chip-online">Actif</span>
          </div>
        </div>
      </header>

      <!-- Date Selection & Route Controls Card -->
      <section class="controls-card">
        <!-- Row 1: Date Selector Pills & Dropdown -->
        <div class="date-controls-row">
          <div class="date-label-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Date du trajet :</span>
          </div>

          <!-- Date Quick Filter Pills -->
          <div class="date-pills-list">
            <button
              type="button"
              class="btn-date-pill"
              :class="{ 'is-active': selectedDate === 'all' }"
              @click="selectDate('all')"
            >
              <span>Toutes les dates</span>
              <span class="pill-count">({{ allPoints.length }})</span>
            </button>

            <button
              v-for="d in availableDates"
              :key="d.date"
              type="button"
              class="btn-date-pill"
              :class="{ 'is-active': selectedDate === d.date }"
              @click="selectDate(d.date)"
            >
              <span>{{ d.label }}</span>
              <span class="pill-count">({{ d.count }})</span>
            </button>
          </div>

          <!-- Date Navigation Arrows -->
          <div class="date-nav-arrows">
            <button
              type="button"
              class="btn-nav-arrow"
              :disabled="isFirstDate"
              @click="prevDate"
              title="Jour précédent"
            >
              ‹ Précédent
            </button>
            <button
              type="button"
              class="btn-nav-arrow"
              :disabled="isLastDate"
              @click="nextDate"
              title="Jour suivant"
            >
              Suivant ›
            </button>
          </div>
        </div>

        <!-- Row 2: Route Playback & Simulation Bar -->
        <div class="playback-row">
          <div class="playback-controls">
            <button
              type="button"
              class="btn-playback-toggle"
              :class="{ 'is-active': isPlaying }"
              :disabled="filteredPoints.length < 2"
              @click="togglePlayback"
            >
              <svg v-if="!isPlaying" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
              <span>{{ isPlaying ? 'Pause' : 'Rejouer le trajet' }}</span>
            </button>

            <button
              type="button"
              class="btn-playback-reset"
              :disabled="playbackIndex === 0"
              @click="resetPlayback"
              title="Revenir au départ"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
              <span>Départ</span>
            </button>

            <!-- Playback Speed Multipliers -->
            <div class="speed-selector">
              <span class="speed-label">Vitesse :</span>
              <button
                v-for="s in [1, 2, 5, 10]"
                :key="s"
                type="button"
                class="btn-speed"
                :class="{ 'is-active': playbackSpeed === s }"
                @click="playbackSpeed = s"
              >
                {{ s }}x
              </button>
            </div>
          </div>

          <!-- Playback Scrubber Slider -->
          <div v-if="filteredPoints.length > 1" class="playback-scrubber-wrap">
            <input
              type="range"
              min="0"
              :max="filteredPoints.length - 1"
              v-model.number="playbackIndex"
              @input="onScrub"
              class="playback-slider"
            />
            <div class="playback-scrub-info">
              <span>Point {{ playbackIndex + 1 }} / {{ filteredPoints.length }}</span>
              <span v-if="currentScrubPoint" class="scrub-timestamp">
                {{ formatDateTime(currentScrubPoint.created_at) }} • {{ currentScrubPoint.speed }} km/h
              </span>
            </div>
          </div>

          <!-- Map Action Tools -->
          <div class="playback-tools">
            <button
              type="button"
              class="btn-map-action"
              @click="fitBounds"
              title="Recadrer la carte sur l'ensemble du parcours"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
              <span>Recadrer</span>
            </button>

            <button
              type="button"
              class="btn-map-action"
              @click="toggleFullscreen"
              title="Plein écran"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                <polyline points="15 3 21 3 21 9"/>
                <polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/>
                <line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
              <span>Plein écran</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Metrics HUD Grid -->
      <section class="metrics-grid">
        <div class="metric-card">
          <div class="metric-card-icon icon-dist">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div class="metric-card-body">
            <div class="metric-card-label">Distance parcourue</div>
            <div class="metric-card-value">{{ routeStats.distanceKm }} <span class="metric-unit">km</span></div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-icon icon-points">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="metric-card-body">
            <div class="metric-card-label">Relevés GPS</div>
            <div class="metric-card-value">{{ routeStats.pointsCount }} <span class="metric-unit">points</span></div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-icon icon-time">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div class="metric-card-body">
            <div class="metric-card-label">Durée totale</div>
            <div class="metric-card-value">{{ routeStats.durationStr }}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-icon icon-speed">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 14l3-3"/>
              <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
            </svg>
          </div>
          <div class="metric-card-body">
            <div class="metric-card-label">Vitesse max / Moyenne</div>
            <div class="metric-card-value">
              {{ routeStats.maxSpeed }} <span class="metric-unit">km/h</span>
              <span class="metric-subvalue">({{ routeStats.avgSpeed }} moy.)</span>
            </div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-icon icon-start">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10 8 16 12 10 16" fill="currentColor"/>
            </svg>
          </div>
          <div class="metric-card-body">
            <div class="metric-card-label">Départ</div>
            <div class="metric-card-value text-time">{{ routeStats.startTimeStr }}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card-icon icon-end">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
          </div>
          <div class="metric-card-body">
            <div class="metric-card-label">Arrivée</div>
            <div class="metric-card-value text-time">{{ routeStats.endTimeStr }}</div>
          </div>
        </div>
      </section>

      <!-- The Big Route Map Container -->
      <section class="map-section-wrapper" :class="{ 'is-fullscreen': isFullscreen }">
        <div v-if="filteredPoints.length > 0" ref="mapContainerEl" class="trajectory-map-view"></div>
        <div v-else class="trajectory-map-view trajectory-map-empty">
          <div class="empty-state-content">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <h3>Aucune coordonnée GPS enregistrée</h3>
            <p>Sélectionnez une autre date ou attendez que le tracker transmette de nouvelles positions.</p>
          </div>
        </div>

        <!-- Fullscreen Exit Button -->
        <button
          v-if="isFullscreen"
          type="button"
          class="btn-exit-fullscreen"
          @click="toggleFullscreen"
          title="Quitter le mode plein écran (Échap)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
          <span>Fermer (Échap)</span>
        </button>

        <!-- Floating Live HUD on Map -->
        <div v-if="filteredPoints.length > 0" class="map-floating-hud">
          <div class="hud-item">
            <span class="hud-dot"></span>
            <span>Date : <strong>{{ formatDisplayDate(selectedDate) }}</strong></span>
          </div>
          <span class="hud-sep">|</span>
          <div class="hud-item">
            <span>{{ routeStats.distanceKm }} km tracés</span>
          </div>
          <span class="hud-sep">|</span>
          <div class="hud-item">
            <span>{{ routeStats.pointsCount }} positions</span>
          </div>
        </div>
      </section>

      <!-- Points Log & Waypoints Inspector -->
      <section class="waypoints-section">
        <div class="section-title-row">
          <h2 class="section-title">Points de passage chronologiques ({{ filteredPoints.length }})</h2>
          <span class="section-hint">Cliquez sur un point pour le localiser directement sur la carte</span>
        </div>

        <div class="waypoints-table-wrap">
          <table class="waypoints-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Heure</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Vitesse</th>
                <th>Batterie</th>
                <th>Satellites</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(p, idx) in paginatedPoints"
                :key="p.id"
                :class="{ 'is-active-point': playbackIndex === (tablePage * tablePerPage + idx) }"
                @click="jumpToPoint(tablePage * tablePerPage + idx)"
              >
                <td>
                  <span
                    class="point-index-badge"
                    :class="{
                      'badge-start': (tablePage * tablePerPage + idx) === 0,
                      'badge-end': (tablePage * tablePerPage + idx) === filteredPoints.length - 1
                    }"
                  >
                    {{ (tablePage * tablePerPage + idx) === 0 ? 'DÉPART' : (tablePage * tablePerPage + idx) === filteredPoints.length - 1 ? 'ARRIVÉE' : (tablePage * tablePerPage + idx + 1) }}
                  </span>
                </td>
                <td>{{ formatDateTime(p.created_at) }}</td>
                <td>{{ p.lat.toFixed(5) }}°</td>
                <td>{{ p.lng.toFixed(5) }}°</td>
                <td>
                  <span class="speed-badge" :class="p.speed > 50 ? 'speed-fast' : p.speed > 0 ? 'speed-moving' : 'speed-static'">
                    {{ Math.round(p.speed) }} km/h
                  </span>
                </td>
                <td>{{ p.charge }}%</td>
                <td>{{ p.satellites }} sats</td>
                <td>
                  <button type="button" class="btn-point-locate" @click.stop="jumpToPoint(tablePage * tablePerPage + idx)">
                    <span>Localiser</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Table Pagination -->
        <div v-if="totalPages > 1" class="table-pagination">
          <button
            type="button"
            class="btn-page-nav"
            :disabled="tablePage === 0"
            @click="tablePage--"
          >
            ‹ Précédent
          </button>
          <span class="page-indicator">Page {{ tablePage + 1 }} sur {{ totalPages }}</span>
          <button
            type="button"
            class="btn-page-nav"
            :disabled="tablePage >= totalPages - 1"
            @click="tablePage++"
          >
            Suivant ›
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'

const route = useRoute()

// ─── State ────────────────────────────────────────────────────────────────────
const trackerId       = ref(parseInt(route.query.tracker_id, 10) || 1)
const trackerName     = ref('TestTracker1')
const latestLocation  = ref(null)

const allPoints       = ref([])
const selectedDate    = ref('all')
const isLoading       = ref(false)

// Map & Layers
const mapContainerEl  = ref(null)
const isFullscreen    = ref(false)
let mapInstance       = null
let polylineLayer     = null
let casingLayer       = null
let startMarker       = null
let endMarker         = null
let playbackMarker    = null

// Playback Simulation
const isPlaying       = ref(false)
const playbackIndex   = ref(0)
const playbackSpeed   = ref(1)
let playbackTimer     = null

// Table Pagination
const tablePage       = ref(0)
const tablePerPage    = ref(15)

// ─── Formatting & Distance ────────────────────────────────────────────────────
function calcHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371 // km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatDisplayDate(dateStr) {
  if (!dateStr || dateStr === 'all') return 'Toutes les dates'
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    const todayStr = new Date().toISOString().slice(0, 10)
    const isToday = dateStr === todayStr
    const formatted = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    return isToday ? `${formatted} (Aujourd'hui)` : formatted
  }
  return dateStr
}

function formatDateTime(iso) {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  } catch {
    return '--'
  }
}

// ─── Computed Data ────────────────────────────────────────────────────────────
const availableDates = computed(() => {
  const mapCounts = {}
  for (const p of allPoints.value) {
    if (p.date_str) {
      mapCounts[p.date_str] = (mapCounts[p.date_str] || 0) + 1
    }
  }
  return Object.keys(mapCounts)
    .sort()
    .reverse()
    .map(date => ({
      date,
      count: mapCounts[date],
      label: formatDisplayDate(date),
    }))
})

const filteredPoints = computed(() => {
  if (!selectedDate.value || selectedDate.value === 'all') {
    return allPoints.value
  }
  return allPoints.value.filter(p => p.date_str === selectedDate.value)
})

const isFirstDate = computed(() => {
  if (selectedDate.value === 'all') return true
  const idx = availableDates.value.findIndex(d => d.date === selectedDate.value)
  return idx >= availableDates.value.length - 1
})

const isLastDate = computed(() => {
  if (selectedDate.value === 'all') return false
  const idx = availableDates.value.findIndex(d => d.date === selectedDate.value)
  return idx <= 0
})

const currentScrubPoint = computed(() => {
  return filteredPoints.value[playbackIndex.value] || null
})

const routeStats = computed(() => {
  const pts = filteredPoints.value
  if (!pts || pts.length === 0) {
    return {
      distanceKm: '0.00',
      pointsCount: 0,
      durationStr: '--',
      startTimeStr: '--',
      endTimeStr: '--',
      avgSpeed: 0,
      maxSpeed: 0,
    }
  }

  let totalDist = 0
  let maxSpd = 0
  let sumSpd = 0

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    if (p.speed > maxSpd) maxSpd = p.speed
    sumSpd += p.speed

    if (i > 0) {
      const prev = pts[i - 1]
      const d = calcHaversine(prev.lat, prev.lng, p.lat, p.lng)
      if (d < 50) totalDist += d
    }
  }

  const firstTime = new Date(pts[0].created_at).getTime()
  const lastTime = new Date(pts[pts.length - 1].created_at).getTime()
  const diffMinutes = Math.max(0, Math.round((lastTime - firstTime) / 60000))
  const hours = Math.floor(diffMinutes / 60)
  const mins = diffMinutes % 60
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`

  return {
    distanceKm: totalDist.toFixed(2),
    pointsCount: pts.length,
    durationStr,
    startTimeStr: formatDateTime(pts[0].created_at),
    endTimeStr: formatDateTime(pts[pts.length - 1].created_at),
    avgSpeed: Math.round(sumSpd / pts.length),
    maxSpeed: Math.round(maxSpd),
  }
})

const totalPages = computed(() => {
  return Math.ceil(filteredPoints.value.length / tablePerPage.value) || 1
})

const paginatedPoints = computed(() => {
  const start = tablePage.value * tablePerPage.value
  return filteredPoints.value.slice(start, start + tablePerPage.value)
})

// ─── Fetching Data ────────────────────────────────────────────────────────────
async function loadData() {
  isLoading.value = true
  try {
    let rows = []

    // 1. Direct Supabase: paginate with .range() to fetch ALL data (bypassing 1000-row limit)
    try {
      let allRows = []
      let page = 0
      const pageSize = 1000
      while (true) {
        let query = supabase
          .from('gps_logs')
          .select('id, tracker_id, latitude, longitude, speed, satellites, charge, created_at')
          .order('created_at', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (trackerId.value) {
          query = query.or(`tracker_id.eq.${trackerId.value},tracker_id.is.null`)
        }

        const { data, error } = await query
        if (error) {
          console.warn('[Trajectory loadData Supabase error]', error)
          break
        }
        if (!data || data.length === 0) break
        allRows.push(...data)
        if (data.length < pageSize) break
        page++
      }

      if (allRows.length > 0) {
        rows = allRows
      }
    } catch (e) {
      console.warn('[Trajectory loadData Supabase error]', e)
    }

    // 2. Fallback API
    if (rows.length === 0) {
      try {
        const res = await fetch(`/api/gps/history?tracker_id=${trackerId.value || ''}`)
        if (res.ok) {
          const apiData = await res.json()
          if (apiData && Array.isArray(apiData.points)) {
            rows = apiData.points
          }
        }
      } catch (e) {
        console.warn('[Trajectory API error]', e)
      }
    }

    const parsed = []
    for (const r of rows) {
      const lat = parseFloat(r.latitude ?? r.lat)
      const lng = parseFloat(r.longitude ?? r.lng)
      if (!isNaN(lat) && !isNaN(lng)) {
        parsed.push({
          id: r.id,
          tracker_id: r.tracker_id,
          lat,
          lng,
          speed: parseFloat(r.speed ?? 0),
          satellites: parseInt(r.satellites ?? 0, 10),
          charge: parseInt(r.charge ?? 0, 10),
          created_at: r.created_at,
          date_str: r.created_at ? r.created_at.slice(0, 10) : '',
        })
      }
    }

    allPoints.value = parsed
    if (parsed.length > 0) {
      latestLocation.value = parsed[parsed.length - 1]
    }

    try {
      const { data: tData } = await supabase
        .from('tracker')
        .select('name')
        .eq('id', trackerId.value)
        .maybeSingle()
      if (tData?.name) {
        trackerName.value = tData.name
      }
    } catch {}

    // Set default date to the latest available day
    if (availableDates.value.length > 0 && selectedDate.value === 'all') {
      selectedDate.value = availableDates.value[0].date
    }

    await nextTick()
    if (!mapInstance && mapContainerEl.value) {
      await initMap()
    } else if (mapInstance) {
      drawRoute()
    }
  } catch (err) {
    console.error('[Trajectory loadData]', err)
  } finally {
    isLoading.value = false
  }
}

// ─── Leaflet Map Setup ────────────────────────────────────────────────────────
async function initMap() {
  if (!mapContainerEl.value) return
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }

  const defaultCenter = filteredPoints.value.length > 0
    ? [filteredPoints.value[0].lat, filteredPoints.value[0].lng]
    : [46.539, 6.662]

  const m = L.map(mapContainerEl.value, {
    zoomControl: true,
    attributionControl: true,
  }).setView(defaultCenter, 14)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(m)

  mapInstance = m
  drawRoute()
  setTimeout(() => m.invalidateSize(), 150)
}

async function drawRoute() {
  if (!mapInstance) return
  const L = (await import('leaflet')).default

  if (casingLayer) { mapInstance.removeLayer(casingLayer); casingLayer = null }
  if (polylineLayer) { mapInstance.removeLayer(polylineLayer); polylineLayer = null }
  if (startMarker) { mapInstance.removeLayer(startMarker); startMarker = null }
  if (endMarker) { mapInstance.removeLayer(endMarker); endMarker = null }
  if (playbackMarker) { mapInstance.removeLayer(playbackMarker); playbackMarker = null }

  const pts = filteredPoints.value
  if (!pts || pts.length === 0) return

  const latlngs = pts.map(p => [p.lat, p.lng])

  // Outer glow layer
  casingLayer = L.polyline(latlngs, {
    color: '#ea580c',
    weight: 8,
    opacity: 0.35,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(mapInstance)

  // Main vivid route line
  polylineLayer = L.polyline(latlngs, {
    color: '#f05000',
    weight: 4,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(mapInstance)

  polylineLayer.on('click', (e) => {
    L.popup()
      .setLatLng(e.latlng)
      .setContent(`
        <div style="font-family: inherit; font-size: 13px; line-height: 1.4;">
          <strong style="color: #f05000;">Tracé du trajet</strong><br/>
          <span>Date : ${formatDisplayDate(selectedDate.value)}</span><br/>
          <span>Position : ${e.latlng.lat.toFixed(5)}°N, ${e.latlng.lng.toFixed(5)}°E</span>
        </div>
      `)
      .openOn(mapInstance)
  })

  // Start marker (Green D)
  const first = pts[0]
  const startIcon = L.divIcon({
    className: '',
    html: `<div class="route-marker-pin start-pin"><span>D</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
  startMarker = L.marker([first.lat, first.lng], { icon: startIcon }).addTo(mapInstance)
  startMarker.bindPopup(`
    <div style="font-family: inherit; font-size: 13px;">
      <strong style="color: #22c55e;">Point de départ</strong><br/>
      <span>Date : ${formatDisplayDate(first.date_str)}</span><br/>
      <span>Heure : ${formatDateTime(first.created_at)}</span><br/>
      <span>Vitesse : ${first.speed} km/h</span>
    </div>
  `)

  // End marker (Orange A)
  if (pts.length > 1) {
    const last = pts[pts.length - 1]
    const endIcon = L.divIcon({
      className: '',
      html: `<div class="route-marker-pin end-pin"><span>A</span></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    })
    endMarker = L.marker([last.lat, last.lng], { icon: endIcon }).addTo(mapInstance)
    endMarker.bindPopup(`
      <div style="font-family: inherit; font-size: 13px;">
        <strong style="color: #f05000;">Point d'arrivée</strong><br/>
        <span>Date : ${formatDisplayDate(last.date_str)}</span><br/>
        <span>Heure : ${formatDateTime(last.created_at)}</span><br/>
        <span>Vitesse : ${last.speed} km/h</span>
      </div>
    `)
  }

  fitBounds()
}

function fitBounds() {
  if (!mapInstance || !polylineLayer) return
  try {
    const bounds = polylineLayer.getBounds()
    if (bounds.isValid()) {
      mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 })
    }
  } catch (e) {
    console.warn('[fitBounds]', e)
  }
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  nextTick(() => {
    setTimeout(() => {
      if (mapInstance) {
        mapInstance.invalidateSize()
        fitBounds()
      }
    }, 150)
  })
}

// ─── Playback & Scrubbing ─────────────────────────────────────────────────────
function selectDate(date) {
  selectedDate.value = date
  tablePage.value = 0
  stopPlayback()
  playbackIndex.value = 0
  drawRoute()
}

function prevDate() {
  const dates = availableDates.value
  if (dates.length === 0) return
  const idx = dates.findIndex(d => d.date === selectedDate.value)
  if (idx < dates.length - 1) {
    selectDate(dates[idx + 1].date)
  }
}

function nextDate() {
  const dates = availableDates.value
  if (dates.length === 0) return
  const idx = dates.findIndex(d => d.date === selectedDate.value)
  if (idx > 0) {
    selectDate(dates[idx - 1].date)
  } else if (idx === -1) {
    selectDate(dates[0].date)
  }
}

function togglePlayback() {
  if (isPlaying.value) {
    stopPlayback()
  } else {
    startPlayback()
  }
}

async function startPlayback() {
  const pts = filteredPoints.value
  if (!pts || pts.length < 2 || !mapInstance) return
  const L = (await import('leaflet')).default

  if (playbackIndex.value >= pts.length - 1) {
    playbackIndex.value = 0
  }

  isPlaying.value = true

  if (!playbackMarker) {
    const pIcon = L.divIcon({
      className: '',
      html: `
        <div class="route-playback-pin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
        </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
    playbackMarker = L.marker([pts[playbackIndex.value].lat, pts[playbackIndex.value].lng], {
      icon: pIcon,
      zIndexOffset: 1000,
    }).addTo(mapInstance)
  }

  if (playbackTimer) clearInterval(playbackTimer)

  const intervalTime = Math.max(20, Math.floor(100 / playbackSpeed.value))
  playbackTimer = setInterval(() => {
    playbackIndex.value++
    if (playbackIndex.value >= pts.length - 1) {
      playbackIndex.value = pts.length - 1
      const last = pts[playbackIndex.value]
      if (playbackMarker) playbackMarker.setLatLng([last.lat, last.lng])
      stopPlayback()
      return
    }
    const cur = pts[playbackIndex.value]
    if (playbackMarker && cur) {
      playbackMarker.setLatLng([cur.lat, cur.lng])
    }
  }, intervalTime)
}

function stopPlayback() {
  isPlaying.value = false
  if (playbackTimer) {
    clearInterval(playbackTimer)
    playbackTimer = null
  }
}

function resetPlayback() {
  stopPlayback()
  playbackIndex.value = 0
  const pts = filteredPoints.value
  if (playbackMarker && pts[0]) {
    playbackMarker.setLatLng([pts[0].lat, pts[0].lng])
  }
}

function onScrub() {
  const pts = filteredPoints.value
  const cur = pts[playbackIndex.value]
  if (cur && mapInstance) {
    if (playbackMarker) {
      playbackMarker.setLatLng([cur.lat, cur.lng])
    }
  }
}

function jumpToPoint(idx) {
  const pts = filteredPoints.value
  if (!pts[idx] || !mapInstance) return
  playbackIndex.value = idx
  onScrub()
  mapInstance.panTo([pts[idx].lat, pts[idx].lng], { animate: true, duration: 0.4 })
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadData()

  // Realtime subscription
  supabase
    .channel('gps_logs_trajectory_page')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gps_logs' }, (payload) => {
      if (payload?.new) {
        const item = {
          id: payload.new.id,
          tracker_id: payload.new.tracker_id,
          lat: parseFloat(payload.new.latitude),
          lng: parseFloat(payload.new.longitude),
          speed: parseFloat(payload.new.speed ?? 0),
          satellites: parseInt(payload.new.satellites ?? 0, 10),
          charge: parseInt(payload.new.charge ?? 0, 10),
          created_at: payload.new.created_at,
          date_str: payload.new.created_at ? payload.new.created_at.slice(0, 10) : '',
        }
        allPoints.value.push(item)
        if (selectedDate.value === 'all' || selectedDate.value === item.date_str) {
          drawRoute()
        }
      }
    })
    .subscribe()
})

onUnmounted(() => {
  stopPlayback()
  if (mapInstance) mapInstance.remove()
})

watch(filteredPoints, () => {
  drawRoute()
})
</script>

<style scoped>
.trajectory-page {
  min-height: calc(100vh - 70px);
  padding: 32px 24px 64px;
  background-color: var(--bg-body, #07090b);
  color: var(--text-primary, #ffffff);
}

.trajectory-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ─── Page Header ─────────────────────────────────────────────────────────── */
.trajectory-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.page-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--accent-orange, #f05000);
  margin-bottom: 8px;
}

.badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-orange, #f05000);
  box-shadow: 0 0 8px var(--accent-orange, #f05000);
}

.page-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 8px 0;
  color: #ffffff;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary, #94a3b8);
  margin: 0;
  max-width: 650px;
  line-height: 1.5;
}

.tracker-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(18, 24, 32, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}

.tracker-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 8px #22c55e;
}

.tracker-chip-online {
  background: rgba(34, 197, 94, 0.18);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.35);
  font-size: 10px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

/* ─── Controls Card ───────────────────────────────────────────────────────── */
.controls-card {
  background: rgba(15, 20, 26, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  backdrop-filter: blur(8px);
}

.date-controls-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.date-label-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #cbd5e1;
}

.date-pills-list {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

.btn-date-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.btn-date-pill:hover {
  background: rgba(255, 255, 255, 0.09);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
}

.btn-date-pill.is-active {
  background: rgba(240, 80, 0, 0.18);
  border-color: var(--accent-orange, #f05000);
  color: #ffffff;
  box-shadow: 0 0 12px rgba(240, 80, 0, 0.25);
}

.pill-count {
  color: #94a3b8;
  font-size: 11px;
}

.date-nav-arrows {
  display: flex;
  gap: 6px;
}

.btn-nav-arrow {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-nav-arrow:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.btn-nav-arrow:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ─── Playback Row ────────────────────────────────────────────────────────── */
.playback-row {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-playback-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--accent-orange, #f05000);
  border: 1px solid transparent;
  color: #ffffff;
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-playback-toggle:hover:not(:disabled) {
  background: #ff6a1a;
  transform: translateY(-1px);
}

.btn-playback-toggle.is-active {
  background: #dc2626;
}

.btn-playback-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-playback-reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.btn-playback-reset:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.btn-playback-reset:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.speed-selector {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
}

.speed-label {
  font-size: 12px;
  color: #94a3b8;
  margin-right: 2px;
}

.btn-speed {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-speed.is-active {
  background: rgba(240, 80, 0, 0.2);
  border-color: var(--accent-orange, #f05000);
  color: #ffffff;
}

.playback-scrubber-wrap {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.playback-slider {
  width: 100%;
  accent-color: var(--accent-orange, #f05000);
  cursor: pointer;
}

.playback-scrub-info {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
}

.scrub-timestamp {
  color: #cbd5e1;
  font-weight: 600;
}

.playback-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-map-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.btn-map-action:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

/* ─── Metrics Grid ────────────────────────────────────────────────────────── */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.metric-card {
  background: rgba(15, 20, 26, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(6px);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  border-color: rgba(240, 80, 0, 0.3);
}

.metric-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.metric-card-icon.icon-dist { color: #f05000; background: rgba(240, 80, 0, 0.1); border-color: rgba(240, 80, 0, 0.2); }
.metric-card-icon.icon-points { color: #38bdf8; background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.2); }
.metric-card-icon.icon-time { color: #a855f7; background: rgba(168, 85, 247, 0.1); border-color: rgba(168, 85, 247, 0.2); }
.metric-card-icon.icon-speed { color: #eab308; background: rgba(234, 179, 8, 0.1); border-color: rgba(234, 179, 8, 0.2); }
.metric-card-icon.icon-start { color: #22c55e; background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.2); }
.metric-card-icon.icon-end { color: #ef4444; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); }

.metric-card-body {
  display: flex;
  flex-direction: column;
}

.metric-card-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.metric-card-value {
  font-size: 19px;
  font-weight: 800;
  color: #ffffff;
}

.metric-unit {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
}

.metric-subvalue {
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
  margin-left: 4px;
}

.text-time {
  font-size: 16px;
  color: #38bdf8;
}

/* ─── Map View ────────────────────────────────────────────────────────────── */
.map-section-wrapper {
  position: relative;
  background: #0b0f13;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}

.trajectory-map-view {
  width: 100%;
  height: 560px;
}

.trajectory-map-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #07090b;
}

.empty-state-content {
  text-align: center;
  color: #94a3b8;
}

.empty-state-content svg {
  margin-bottom: 12px;
  color: #64748b;
}

.empty-state-content h3 {
  color: #ffffff;
  margin: 0 0 6px 0;
  font-size: 18px;
}

.empty-state-content p {
  margin: 0;
  font-size: 13px;
}

.map-floating-hud {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 1000;
  background: rgba(12, 16, 20, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  padding: 6px 14px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: #e2e8f0;
}

.hud-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-orange, #f05000);
  box-shadow: 0 0 6px var(--accent-orange, #f05000);
  display: inline-block;
  margin-right: 4px;
}

.hud-sep {
  color: #475569;
}

/* Fullscreen Mode */
.map-section-wrapper.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  border-radius: 0;
  border: none;
}

.map-section-wrapper.is-fullscreen .trajectory-map-view {
  height: 100vh;
}

.btn-exit-fullscreen {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 10000;
  background: rgba(12, 16, 20, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  backdrop-filter: blur(6px);
  transition: all 0.2s ease;
}

.btn-exit-fullscreen:hover {
  background: rgba(220, 38, 38, 0.9);
  border-color: #ef4444;
}

/* ─── Leaflet Marker Pins ─────────────────────────────────────────────────── */
:deep(.route-marker-pin) {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #ffffff;
  font-weight: 800;
  font-size: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
  cursor: pointer;
  transition: transform 0.2s ease;
}

:deep(.route-marker-pin:hover) {
  transform: scale(1.2);
}

:deep(.route-marker-pin.start-pin) {
  background: #22c55e;
  border: 2px solid #ffffff;
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.8);
}

:deep(.route-marker-pin.end-pin) {
  background: #f05000;
  border: 2px solid #ffffff;
  box-shadow: 0 0 12px rgba(240, 80, 0, 0.8);
}

:deep(.route-playback-pin) {
  width: 28px;
  height: 28px;
  background: #0284c7;
  border: 2px solid #ffffff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 0 18px rgba(2, 132, 199, 0.95);
  animation: pulse-playback 1.2s ease-in-out infinite;
}

@keyframes pulse-playback {
  0%, 100% { box-shadow: 0 0 8px rgba(2, 132, 199, 0.6); }
  50% { box-shadow: 0 0 20px rgba(2, 132, 199, 1); }
}

/* ─── Waypoints Table ─────────────────────────────────────────────────────── */
.waypoints-section {
  background: rgba(15, 20, 26, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 20px;
  backdrop-filter: blur(8px);
}

.section-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: #ffffff;
}

.section-hint {
  font-size: 12px;
  color: #94a3b8;
}

.waypoints-table-wrap {
  overflow-x: auto;
}

.waypoints-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.waypoints-table th {
  text-align: left;
  padding: 10px 12px;
  color: #94a3b8;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
}

.waypoints-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: #e2e8f0;
  white-space: nowrap;
}

.waypoints-table tr:hover {
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
}

.waypoints-table tr.is-active-point {
  background: rgba(240, 80, 0, 0.12);
}

.point-index-badge {
  display: inline-block;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
}

.point-index-badge.badge-start {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.point-index-badge.badge-end {
  background: rgba(240, 80, 0, 0.2);
  color: #ff8a4c;
  border: 1px solid rgba(240, 80, 0, 0.4);
}

.speed-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
}

.speed-static {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
}

.speed-moving {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.speed-fast {
  background: rgba(240, 80, 0, 0.2);
  color: #ff7849;
}

.btn-point-locate {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #94a3b8;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-point-locate:hover {
  background: var(--accent-orange, #f05000);
  border-color: var(--accent-orange, #f05000);
  color: #ffffff;
}

.table-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 14px;
}

.btn-page-nav {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 5px 12px;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
}

.btn-page-nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.btn-page-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 12px;
  color: #94a3b8;
}

@media (max-width: 768px) {
  .trajectory-page {
    padding: 16px 14px 48px;
  }
  .page-title {
    font-size: 22px;
  }
  .trajectory-map-view {
    height: 400px;
  }
}
</style>

