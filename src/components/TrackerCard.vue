<template>
  <!-- Fullscreen overlay with animated opening/closing -->
  <Teleport to="body">
    <Transition name="fs-fade" @after-leave="onFsAfterLeave">
      <div v-if="fullscreen" class="map-fullscreen-overlay" @keydown.escape="closeFullscreen" tabindex="-1">
        <div class="map-fullscreen-card">
          <!-- Laser scanline sweep on open -->
          <div class="fs-scanline"></div>

          <!-- Futuristic HUD Corner Brackets -->
          <div class="hud-corner hud-corner-tl"></div>
          <div class="hud-corner hud-corner-tr"></div>
          <div class="hud-corner hud-corner-bl"></div>
          <div class="hud-corner hud-corner-br"></div>

          <div ref="fullscreenMapEl" class="map-fullscreen-container"></div>
          <button class="map-fullscreen-close" @click="closeFullscreen" title="Fermer (Échap)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div v-if="location" class="map-fullscreen-coords">
            <span class="fs-coords-text">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-orange); margin-right: 4px; vertical-align: -1px;">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <line x1="12" y1="2" x2="12" y2="22"/>
              </svg>
              {{ location.lat.toFixed(5) }}°N, {{ location.lng.toFixed(5) }}°E
            </span>
            <span class="fs-coords-sep">|</span>
            <span :class="['fs-dot', isOnline ? 'online' : 'offline']"></span>
            <span class="fs-status-label">{{ isOnline ? 'EN LIGNE' : 'HORS LIGNE' }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <div class="tracker-card" :class="[scanlineType, { 'is-card-locked': isLocked, 'is-card-unlocked': !isLocked }]">
    <!-- Futuristic scanline beam sweep across card on lock/unlock -->
    <div v-if="scanlineActive" class="card-security-scanline" :class="scanlineType"></div>

    <!-- Micro-toast floating notification -->
    <Transition name="toast-pop">
      <div v-if="toastActive" :class="['tracker-toast', `toast-${toastType}`]">
        <span class="toast-dot"></span>
        <span class="toast-msg">{{ toastText }}</span>
      </div>
    </Transition>

    <!-- In-card animated delete confirmation popup overlay -->
    <Transition name="confirm-slide">
      <div v-if="showDeleteConfirm" class="card-confirm-overlay">
        <div class="card-confirm-modal">
          <div class="confirm-icon-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </div>
          <div class="confirm-title">Supprimer ce tracker ?</div>
          <div class="confirm-subtitle">Simulation mode test — Aucune donnée effacée</div>
          <div class="confirm-actions">
            <button class="btn-confirm-yes" :disabled="deleteInProgress" @click="executeDelete">
              {{ deleteInProgress ? 'Suppression…' : 'Confirmer' }}
            </button>
            <button class="btn-confirm-no" @click="cancelDelete">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </Transition>

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
      <button v-if="location" class="map-expand-btn btn-expand-interactive" @click="openFullscreen" title="Plein écran">
        <svg class="expand-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      </button>
    </div>

    <div class="tracker-card-body">

      <!-- Row 1: Name (with rename pencil icon) — Batterie -->
      <div class="tracker-name-battery">
        <div class="tracker-name-container">
          <template v-if="!isEditingName">
            <span class="tracker-name" :title="trackerName">{{ trackerName }}</span>
            <button
              type="button"
              class="btn-rename-tracker"
              @click="startEditingName"
              title="Renommer le tracker"
              aria-label="Renommer le tracker"
            >
              <svg class="pencil-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
          </template>

          <form v-else class="tracker-rename-form" @submit.prevent="saveTrackerName">
            <input
              ref="nameInputRef"
              v-model="editNameValue"
              type="text"
              class="tracker-name-input"
              maxlength="35"
              placeholder="Nom du tracker"
              :disabled="isSavingName"
              @keydown.escape="cancelEditingName"
            />
            <button
              type="submit"
              class="btn-rename-save"
              :disabled="isSavingName || !editNameValue.trim()"
              title="Enregistrer (Entrée)"
              aria-label="Enregistrer"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <button
              type="button"
              class="btn-rename-cancel"
              :disabled="isSavingName"
              @click="cancelEditingName"
              title="Annuler (Échap)"
              aria-label="Annuler"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </form>
        </div>

        <span class="tracker-sep"> — </span>
        <span class="tracker-battery-label">Batterie du tracker:</span>
        <span class="tracker-battery" :style="batteryColor">{{ battery }}%</span>
      </div>

      <!-- Row 2: Added date + online/offline badge -->
      <div class="tracker-added-date">
        <span v-if="firstRecordDate">Ajouté le {{ formatLongDate(firstRecordDate) }}</span>
        <span v-else>Aucune donnée</span>
        <span :class="['conn-badge', isConnected ? 'conn-badge-online' : 'conn-badge-offline']">
          <span class="conn-badge-dot"></span>
          {{ isConnected ? 'EN LIGNE' : 'HORS LIGNE' }}
        </span>
      </div>

      <!-- Divider -->
      <div class="card-divider"></div>

      <!-- Row 3: Lock status — movement -->
      <div class="tracker-status">
        <Transition name="status-pill-flip" mode="out-in">
          <span
            :key="isLocked ? 'locked' : 'unlocked'"
            class="status-pill"
            :class="isLocked ? 'status-pill-locked' : 'status-pill-unlocked'"
          >
            <span class="status-pill-dot"></span>
            {{ isLocked ? 'VERROUILLÉ' : 'DÉVERROUILLÉ' }}
          </span>
        </Transition>
        <span class="tracker-sep"> — </span>
        <span class="movement-state" :class="{ 'moving-active': isOnline }">
          <span v-if="isOnline" class="movement-wave-indicator" title="En mouvement">
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
            <span class="wave-bar"></span>
          </span>
          <span v-else class="movement-static-dot"></span>
          {{ isOnline ? 'En mouvement' : 'Pas de mouvement' }}
        </span>
        <Transition name="alert-shake-pop">
          <span
            v-if="movementDetected && isLocked"
            class="movement-alert-badge"
            title="Alerte vol / mouvement non autorisé !"
          >
            🚨 <span class="alert-badge-text">ALERTE</span>
          </span>
        </Transition>
      </div>

      <!-- Buttons -->
      <div class="tracker-actions">
        <button
          class="btn-card-lock btn-shimmer-interactive"
          :class="isLocked ? 'btn-lock-locked' : 'btn-lock-unlocked'"
          @click="toggleLock"
          :title="isLocked ? 'Cliquez pour déverrouiller' : 'Cliquez pour verrouiller'"
        >
          <span class="btn-shimmer-sweep"></span>
          <span class="lock-icon-svg" :class="{ 'is-locked': isLocked }">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path class="shackle-path" :d="isLocked ? 'M7 11V7a5 5 0 0 1 10 0v4' : 'M7 11V7a5 5 0 0 1 9.9 -1'"/>
            </svg>
          </span>
          <Transition name="btn-label-slide" mode="out-in">
            <span :key="isLocked ? 'locked' : 'unlocked'" class="btn-label-text">
              {{ isLocked ? 'Déverrouiller' : 'Verrouiller' }}
            </span>
          </Transition>
        </button>

        <button class="btn-card-danger btn-delete-interactive" @click="confirmDelete">
          <svg class="trash-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
const trackerId       = ref(1)
const location        = ref(null)   // latest GPS row
const firstRecordDate = ref(null)   // oldest GPS row created_at
const lastMovementDate = ref(null)  // when the tracker last meaningfully moved
const movementDetected = ref(false) // new movement since last poll
const isLocked        = ref(true)   // true = alert on movement, false = owner moving
const trackerName     = ref('TestTracker1')

// Rename state
const isEditingName   = ref(false)
const editNameValue   = ref('')
const isSavingName    = ref(false)
const nameInputRef    = ref(null)

const mapEl           = ref(null)
const fullscreenMapEl = ref(null)
const fullscreen      = ref(false)

// ─── Fancy Action Animation States ───────────────────────────────────────────
const scanlineActive    = ref(false)
const scanlineType      = ref('')
const toastActive       = ref(false)
const toastText         = ref('')
const toastType         = ref('locked')
let toastTimer          = null

const showDeleteConfirm = ref(false)
const deleteInProgress  = ref(false)

function triggerToast(text, type = 'locked') {
  if (toastTimer) clearTimeout(toastTimer)
  toastText.value = text
  toastType.value = type
  toastActive.value = true
  toastTimer = setTimeout(() => {
    toastActive.value = false
  }, 2600)
}

function triggerScanline(type) {
  scanlineType.value = type
  scanlineActive.value = true
  setTimeout(() => {
    scanlineActive.value = false
  }, 850)
}

let map          = null
let marker       = null
let fsMap        = null
let fsMarker     = null
let pollInterval = null
let realtimeChannel = null
let trackerRealtimeChannel = null

// ─── Tracker DB Operations (Supabase + fallback API) ──────────────────────────
async function fetchTracker() {
  try {
    let data = null

    // 1. Direct Supabase query
    const { data: supaTracker, error } = await supabase
      .from('tracker')
      .select('id, name, locked, owner_id')
      .order('id', { ascending: true })
      .limit(1)

    if (!error && supaTracker && supaTracker.length > 0) {
      data = supaTracker[0]
    } else {
      // 2. Fallback to /api/tracker (Express proxy)
      try {
        const res = await fetch('/api/tracker')
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          data = await res.json()
        }
      } catch { /* ignore fallback error */ }
    }

    if (data) {
      trackerId.value = data.id
      if (data.name) trackerName.value = data.name
      if (typeof data.locked === 'boolean') {
        isLocked.value = data.locked
      }
    }
  } catch (err) {
    console.error('[fetchTracker]', err)
  }
}

function startEditingName() {
  editNameValue.value = trackerName.value
  isEditingName.value = true
  nextTick(() => {
    if (nameInputRef.value) {
      nameInputRef.value.focus()
      nameInputRef.value.select()
    }
  })
}

function cancelEditingName() {
  isEditingName.value = false
  editNameValue.value = ''
}

async function saveTrackerName() {
  const newName = editNameValue.value.trim()
  if (!newName) {
    cancelEditingName()
    return
  }
  if (newName === trackerName.value) {
    isEditingName.value = false
    return
  }

  isSavingName.value = true
  try {
    let updated = false

    // 1. Try Supabase direct update
    try {
      const { data, error } = await supabase
        .from('tracker')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', trackerId.value)
        .select()

      if (!error && data && data.length > 0) {
        trackerName.value = data[0].name
        updated = true
      }
    } catch (e) {
      console.warn('[saveTrackerName Supabase]', e)
    }

    // 2. Fallback to /api/tracker/:id (Express DB proxy)
    if (!updated) {
      try {
        const res = await fetch(`/api/tracker/${trackerId.value}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        })
        if (res.ok) {
          const data = await res.json()
          trackerName.value = data.name
          updated = true
        }
      } catch (e) {
        console.warn('[saveTrackerName API proxy]', e)
      }
    }

    if (updated) {
      isEditingName.value = false
      triggerToast(`Tracker renommé en « ${newName} »`, 'locked')
    } else {
      triggerToast('Échec de la mise à jour du nom', 'danger')
    }
  } catch (err) {
    console.error('[saveTrackerName]', err)
    triggerToast('Erreur lors du renommage', 'danger')
  } finally {
    isSavingName.value = false
  }
}

// Previous position snapshot for movement detection (2nd decimal precision)
let prevLat = null
let prevLng = null

// ─── Computed ─────────────────────────────────────────────────────────────────
const isOnline = computed(() => {
  if (!location.value) return false
  const delta = Date.now() - new Date(location.value.created_at).getTime()
  return location.value.isOnline ?? delta <= 30_000
})

// Tracker is considered connected (online) if data arrived within the last 10 minutes
const isConnected = computed(() => {
  if (!location.value) return false
  const delta = Date.now() - new Date(location.value.created_at).getTime()
  return delta < 10 * 60 * 1000 // < 10 minutes
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
    let query = supabase
      .from('gps_logs')
      .select('id, latitude, longitude, speed, satellites, charge, tracker_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    if (trackerId.value) {
      query = query.eq('tracker_id', trackerId.value)
    }

    let { data: supaRows, error } = await query

    // Fallback if specific tracker_id has no rows yet
    if ((error || !supaRows || supaRows.length === 0) && trackerId.value) {
      const fallbackQuery = await supabase
        .from('gps_logs')
        .select('id, latitude, longitude, speed, satellites, charge, tracker_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      if (!fallbackQuery.error && fallbackQuery.data?.length > 0) {
        supaRows = fallbackQuery.data
      }
    }

    if (!error && supaRows && supaRows.length > 0) {
      const row = supaRows[0]
      const isOnline = Date.now() - new Date(row.created_at).getTime() <= 30_000
      data = {
        id: row.id,
        tracker_id: row.tracker_id,
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
        const res = await fetch(`/api/gps/latest?tracker_id=${trackerId.value || ''}`)
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
    let query = supabase
      .from('gps_logs')
      .select('created_at, tracker_id')
      .order('created_at', { ascending: true })
      .limit(1)

    if (trackerId.value) {
      query = query.eq('tracker_id', trackerId.value)
    }

    let { data: firstRows, error } = await query
    if ((error || !firstRows || firstRows.length === 0) && trackerId.value) {
      const fallbackQuery = await supabase
        .from('gps_logs')
        .select('created_at, tracker_id')
        .order('created_at', { ascending: true })
        .limit(1)
      if (!fallbackQuery.error && fallbackQuery.data?.length > 0) {
        firstRows = fallbackQuery.data
      }
    }

    if (!error && firstRows && firstRows.length > 0) {
      firstRecordDate.value = firstRows[0].created_at
      if (!lastMovementDate.value) lastMovementDate.value = firstRows[0].created_at
      return
    }

    // 2. Fallback to /api/gps/first
    try {
      const res = await fetch(`/api/gps/first?tracker_id=${trackerId.value || ''}`)
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
}

function onFsAfterLeave() {
  if (fsMap) {
    fsMap.remove()
    fsMap = null
    fsMarker = null
  }
}

// ─── Lock toggle with fancy feedback & database sync ─────────────────────────
async function toggleLock() {
  const nextLockState = !isLocked.value
  isLocked.value = nextLockState

  if (nextLockState) {
    movementDetected.value = false
    triggerScanline('scanline-locked')
    triggerToast('Tracker sécurisé — Surveillance active', 'locked')
  } else {
    triggerScanline('scanline-unlocked')
    triggerToast('Tracker déverrouillé — Mode déplacement', 'unlocked')
  }

  // Persist lock status to DB
  try {
    let persisted = false
    try {
      const { error } = await supabase
        .from('tracker')
        .update({ locked: nextLockState, updated_at: new Date().toISOString() })
        .eq('id', trackerId.value)
      if (!error) persisted = true
    } catch { /* ignore fallback */ }

    if (!persisted) {
      await fetch(`/api/tracker/${trackerId.value}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: nextLockState }),
      })
    }
  } catch (err) {
    console.error('[toggleLock persist]', err)
  }
}

function confirmDelete() {
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
}

function executeDelete() {
  deleteInProgress.value = true
  setTimeout(() => {
    deleteInProgress.value = false
    showDeleteConfirm.value = false
    triggerToast('Suppression simulée (Mode test)', 'danger')
  }, 500)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchTracker()
  await fetchLatest()
  await fetchFirstRecord()
  if (location.value) await initMap()
  // Poll every 10 s
  pollInterval = setInterval(fetchLatest, 10_000)

  // Realtime subscription — reload the page on every new GPS entry
  realtimeChannel = supabase
    .channel('gps_logs_card')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gps_logs' }, () => {
      window.location.reload()
    })
    .subscribe()

  // Realtime subscription for tracker updates (rename / lock changed from elsewhere)
  trackerRealtimeChannel = supabase
    .channel('tracker_card_channel')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tracker' }, (payload) => {
      if (payload.new && payload.new.id == trackerId.value) {
        if (payload.new.name && !isEditingName.value) {
          trackerName.value = payload.new.name
        }
        if (typeof payload.new.locked === 'boolean') {
          isLocked.value = payload.new.locked
        }
      }
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
  if (trackerRealtimeChannel) trackerRealtimeChannel.unsubscribe()
  document.body.classList.remove('map-fullscreen-active')
  if (map) map.remove()
  if (fsMap) fsMap.remove()
})

watch(location, async (newVal) => {
  if (newVal && !map) await initMap()
})
</script>

<style scoped>
/* ─── Tracker Name & Rename Styles ────────────────────────────────────────── */
.tracker-name-container {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
}

.btn-rename-tracker {
  background: transparent;
  border: 1px solid transparent;
  color: #94a3b8;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
  line-height: 1;
}

.btn-rename-tracker:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--accent-orange, #f05000);
  transform: scale(1.1);
}

.btn-rename-tracker .pencil-icon {
  display: block;
}

.tracker-rename-form {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tracker-name-input {
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid var(--accent-orange, #f05000);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 5px;
  outline: none;
  width: 140px;
  box-shadow: 0 0 0 2px rgba(240, 80, 0, 0.25);
  transition: all 0.2s ease;
}

.tracker-name-input:focus {
  border-color: #ff6a1a;
  box-shadow: 0 0 0 3px rgba(240, 80, 0, 0.35);
}

.btn-rename-save {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  background: #22c55e;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.btn-rename-save:hover:not(:disabled) {
  background: #16a34a;
  transform: scale(1.05);
}

.btn-rename-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-rename-cancel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.btn-rename-cancel:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.4);
}

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
  background: rgba(6, 10, 14, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
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
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 25px 70px -10px rgba(0, 0, 0, 0.9), 0 0 35px rgba(249, 87, 33, 0.12);
  background: #0b0f13;
  transform-origin: center center;
}

.map-fullscreen-container {
  width: 100%;
  height: 100%;
}

/* Futuristic HUD Corner Brackets */
.hud-corner {
  position: absolute;
  width: 18px;
  height: 18px;
  border-color: var(--accent-orange);
  border-style: solid;
  pointer-events: none;
  z-index: 1005;
  opacity: 0.85;
}

.hud-corner-tl {
  top: 10px;
  left: 10px;
  border-width: 2px 0 0 2px;
  border-top-left-radius: 4px;
}

.hud-corner-tr {
  top: 10px;
  right: 10px;
  border-width: 2px 2px 0 0;
  border-top-right-radius: 4px;
}

.hud-corner-bl {
  bottom: 10px;
  left: 10px;
  border-width: 0 0 2px 2px;
  border-bottom-left-radius: 4px;
}

.hud-corner-br {
  bottom: 10px;
  right: 10px;
  border-width: 0 2px 2px 0;
  border-bottom-right-radius: 4px;
}

/* Laser scanline sweep on open */
.fs-scanline {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(249, 87, 33, 0.4) 20%,
    rgba(255, 255, 255, 0.95) 50%,
    rgba(249, 87, 33, 0.4) 80%,
    transparent 100%
  );
  box-shadow: 0 0 16px 2px var(--accent-orange), 0 0 30px rgba(249, 87, 33, 0.7);
  z-index: 1008;
  pointer-events: none;
  animation: fs-scanline-sweep 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

@keyframes fs-scanline-sweep {
  0% {
    top: 0%;
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  85% {
    opacity: 0.9;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}

.map-fullscreen-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 1010;
  background: rgba(12, 16, 20, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  color: #ffffff;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}

.map-fullscreen-close:hover {
  background: rgba(220, 38, 38, 0.85);
  border-color: rgba(239, 68, 68, 0.9);
  transform: rotate(90deg) scale(1.08);
  box-shadow: 0 0 18px rgba(220, 38, 38, 0.6);
}

.map-fullscreen-close:active {
  transform: rotate(90deg) scale(0.92);
}

.map-fullscreen-coords {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1010;
  background: rgba(10, 14, 18, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 8px 18px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 10px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(249, 87, 33, 0.12);
  transition: all 0.25s ease;
}

.map-fullscreen-coords:hover {
  border-color: rgba(249, 87, 33, 0.5);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.7), 0 0 20px rgba(249, 87, 33, 0.25);
}

.fs-coords-text {
  display: flex;
  align-items: center;
  color: var(--text-primary);
  font-weight: 600;
}

.fs-coords-sep {
  color: rgba(255, 255, 255, 0.2);
  font-size: 11px;
}

.fs-status-label {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.fs-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.fs-dot.online {
  background: var(--accent-green);
  box-shadow: 0 0 8px var(--accent-green);
  animation: live-blink 1.8s ease-in-out infinite;
}

.fs-dot.offline {
  background: var(--text-muted);
}

/* ─── High-End Fullscreen Opening & Closing Transitions ─────────────────── */
.fs-fade-enter-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              backdrop-filter 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              -webkit-backdrop-filter 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.fs-fade-leave-active {
  transition: opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              backdrop-filter 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              -webkit-backdrop-filter 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.fs-fade-enter-from,
.fs-fade-leave-to {
  opacity: 0 !important;
  backdrop-filter: blur(0px) !important;
  -webkit-backdrop-filter: blur(0px) !important;
}

/* Card zoom and spring */
.fs-fade-enter-active .map-fullscreen-card {
  transition: transform 0.38s cubic-bezier(0.34, 1.45, 0.64, 1),
              opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              filter 0.35s ease,
              box-shadow 0.38s ease;
}

.fs-fade-leave-active .map-fullscreen-card {
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.24s ease-in,
              filter 0.24s ease;
}

.fs-fade-enter-from .map-fullscreen-card {
  opacity: 0;
  transform: scale(0.85) translateY(28px);
  filter: blur(6px);
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
}

.fs-fade-leave-to .map-fullscreen-card {
  opacity: 0;
  transform: scale(0.9) translateY(18px);
  filter: blur(4px);
}

/* Corner brackets slide in */
.fs-fade-enter-active .hud-corner {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.12s;
}

.fs-fade-enter-from .hud-corner-tl {
  transform: translate(-12px, -12px);
  opacity: 0;
}
.fs-fade-enter-from .hud-corner-tr {
  transform: translate(12px, -12px);
  opacity: 0;
}
.fs-fade-enter-from .hud-corner-bl {
  transform: translate(-12px, 12px);
  opacity: 0;
}
.fs-fade-enter-from .hud-corner-br {
  transform: translate(12px, 12px);
  opacity: 0;
}

/* Close button entrance & exit */
.fs-fade-enter-active .map-fullscreen-close {
  transition: all 0.36s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s;
}

.fs-fade-leave-active .map-fullscreen-close {
  transition: all 0.2s ease-in;
}

.fs-fade-enter-from .map-fullscreen-close {
  opacity: 0;
  transform: rotate(-90deg) scale(0.6);
}

.fs-fade-leave-to .map-fullscreen-close {
  opacity: 0;
  transform: scale(0.7);
}

/* Coordinates bar entrance & exit */
.fs-fade-enter-active .map-fullscreen-coords {
  transition: all 0.38s cubic-bezier(0.34, 1.4, 0.64, 1) 0.18s;
}

.fs-fade-leave-active .map-fullscreen-coords {
  transition: all 0.2s ease-in;
}

.fs-fade-enter-from .map-fullscreen-coords {
  opacity: 0;
  transform: translateX(-50%) translateY(24px) scale(0.9);
}

.fs-fade-leave-to .map-fullscreen-coords {
  opacity: 0;
  transform: translateX(-50%) translateY(14px);
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
/* ─── Online / Offline connection badge ─────────────────────────────────── */
.tracker-added-date {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.conn-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 7px 2px 5px;
  border-radius: 20px;
  vertical-align: middle;
  user-select: none;
}

.conn-badge-online {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.conn-badge-offline {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.conn-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.conn-badge-online .conn-badge-dot {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
  animation: dot-blink 1.8s ease-in-out infinite;
}

.conn-badge-offline .conn-badge-dot {
  background: #64748b;
}

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

/* ─── Tracker Card Action Enhancements ───────────────────────────────────── */
.tracker-card {
  position: relative;
  transition: border-color 0.35s ease, box-shadow 0.35s ease;
}

.tracker-card.is-card-locked {
  border-color: rgba(220, 38, 38, 0.3);
}

.tracker-card.is-card-unlocked {
  border-color: rgba(34, 197, 94, 0.3);
}

/* Laser scanline beam */
.card-security-scanline {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  pointer-events: none;
  z-index: 50;
  animation: scanline-pass 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.card-security-scanline.scanline-locked {
  background: #ef4444;
  box-shadow: 0 0 15px 3px rgba(239, 68, 68, 0.8), 0 0 30px 6px rgba(239, 68, 68, 0.4);
}

.card-security-scanline.scanline-unlocked {
  background: #22c55e;
  box-shadow: 0 0 15px 3px rgba(34, 197, 94, 0.8), 0 0 30px 6px rgba(34, 197, 94, 0.4);
}

@keyframes scanline-pass {
  0% {
    top: 0%;
    opacity: 0.9;
  }
  80% {
    opacity: 0.9;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}

/* Floating micro-toast */
.tracker-toast {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  z-index: 70;
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.7);
}

.toast-locked {
  background: rgba(185, 28, 28, 0.92);
  border: 1px solid rgba(239, 68, 68, 0.6);
  color: #ffffff;
}

.toast-unlocked {
  background: rgba(22, 101, 52, 0.92);
  border: 1px solid rgba(34, 197, 94, 0.6);
  color: #ffffff;
}

.toast-danger {
  background: rgba(127, 29, 29, 0.95);
  border: 1px solid rgba(239, 68, 68, 0.7);
  color: #fca5a5;
}

.toast-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 6px #ffffff;
  flex-shrink: 0;
}

.toast-pop-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-pop-leave-active {
  transition: all 0.22s ease-in;
}
.toast-pop-enter-from,
.toast-pop-leave-to {
  opacity: 0;
  transform: translateY(-12px) scale(0.92);
}

/* In-card confirmation modal */
.card-confirm-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  background: rgba(12, 16, 20, 0.94);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}

.card-confirm-modal {
  width: 100%;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.confirm-icon-box {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.15);
  border: 1px solid rgba(220, 38, 38, 0.4);
  color: #f87171;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
  animation: confirm-icon-pulse 1.8s ease-in-out infinite;
}

@keyframes confirm-icon-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 0 0 6px rgba(220, 38, 38, 0);
  }
}

.confirm-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
}

.confirm-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.confirm-actions {
  display: flex;
  gap: 8px;
  width: 100%;
}

.btn-confirm-yes {
  flex: 1;
  background: #dc2626;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-confirm-yes:hover {
  background: #b91c1c;
  box-shadow: 0 2px 10px rgba(220, 38, 38, 0.5);
}

.btn-confirm-no {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-confirm-no:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.confirm-slide-enter-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.confirm-slide-leave-active {
  transition: all 0.2s ease-in;
}
.confirm-slide-enter-from,
.confirm-slide-leave-to {
  opacity: 0;
  transform: scale(0.94);
}

/* Button & Lock Icon Animations */
.btn-card-lock {
  background-color: #ffffff;
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-card-lock:hover {
  transform: translateY(-1px);
}

.btn-lock-locked:hover {
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
}

.btn-lock-unlocked:hover {
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.3);
}

.lock-icon-svg {
  display: inline-flex;
  align-items: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.3s ease;
}

.lock-icon-svg.is-locked {
  color: #dc2626;
  animation: lock-snap 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.lock-icon-svg:not(.is-locked) {
  color: #16a34a;
  animation: unlock-pivot 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.shackle-path {
  transition: d 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes lock-snap {
  0% { transform: scale(1.3) translateY(-2px); }
  60% { transform: scale(0.9) translateY(1px); }
  100% { transform: scale(1) translateY(0); }
}

@keyframes unlock-pivot {
  0% { transform: scale(0.9); }
  50% { transform: scale(1.2) rotate(-8deg); }
  100% { transform: scale(1) rotate(0deg); }
}

.btn-delete-interactive {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-delete-interactive:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(185, 28, 28, 0.4);
}

.trash-icon {
  transition: transform 0.2s ease;
}

.btn-delete-interactive:hover .trash-icon {
  transform: rotate(-12deg) scale(1.1);
}

/* Status Pill & Wave Bars */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 4px;
  transition: all 0.25s ease;
}

.status-pill-locked {
  background: rgba(220, 38, 38, 0.15);
  border: 1px solid rgba(220, 38, 38, 0.4);
  color: #fca5a5;
}

.status-pill-unlocked {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  color: #86efac;
}

.status-pill-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-pill-locked .status-pill-dot {
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}

.status-pill-unlocked .status-pill-dot {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.status-pill-flip-enter-active,
.status-pill-flip-leave-active {
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.status-pill-flip-enter-from {
  opacity: 0;
  transform: rotateX(70deg) translateY(-4px);
}
.status-pill-flip-leave-to {
  opacity: 0;
  transform: rotateX(-70deg) translateY(4px);
}

.movement-wave-indicator {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 10px;
  vertical-align: middle;
  margin-right: 4px;
}

.wave-bar {
  width: 2px;
  background-color: var(--accent-green);
  border-radius: 1px;
  animation: wave-bounce 1s ease-in-out infinite;
}

.wave-bar:nth-child(1) { height: 4px; animation-delay: 0.1s; }
.wave-bar:nth-child(2) { height: 10px; animation-delay: 0.25s; }
.wave-bar:nth-child(3) { height: 6px; animation-delay: 0.4s; }

@keyframes wave-bounce {
  0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
  50% { transform: scaleY(1.2); opacity: 1; }
}

.movement-static-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-muted);
  margin-right: 4px;
}

.movement-alert-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: rgba(220, 38, 38, 0.2);
  border: 1px solid rgba(220, 38, 38, 0.5);
  border-radius: 4px;
  color: #fca5a5;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.05em;
  animation: alert-pulse 1.2s ease-in-out infinite;
}

@keyframes alert-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); box-shadow: 0 0 8px rgba(220, 38, 38, 0.6); }
}

.alert-shake-pop-enter-active {
  animation: alert-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.alert-shake-pop-leave-active {
  transition: opacity 0.2s ease;
}
.alert-shake-pop-leave-to {
  opacity: 0;
}

@keyframes alert-enter {
  0% { transform: scale(0.6); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); }
}

.btn-expand-interactive {
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}
.btn-expand-interactive:hover {
  transform: scale(1.1);
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(255, 255, 255, 0.25);
}
.btn-expand-interactive:hover .expand-icon {
  transform: rotate(5deg);
}
.expand-icon {
  transition: transform 0.2s ease;
}

.btn-label-slide-enter-active,
.btn-label-slide-leave-active {
  transition: all 0.18s ease;
}
.btn-label-slide-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.btn-label-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
