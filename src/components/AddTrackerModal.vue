<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        class="modal-backdrop"
        @click.self="close"
        @keydown.escape="close"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tracker-modal-title"
      >
        <Transition name="modal-pop">
          <div v-if="open" class="modal-card">
            <!-- Modal Header -->
            <div class="modal-card-header">
              <div class="modal-header-title" id="add-tracker-modal-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <span>Ajouter un tracker</span>
              </div>
              <button type="button" class="modal-close-btn" @click="close" aria-label="Fermer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Radar Banner with sweeping scanner -->
            <div class="modal-banner">
              <div class="modal-radar-scanner-beam"></div>
              <div class="modal-radar-pulse">
                <div class="pulse-ring pulse-ring-1"></div>
                <div class="pulse-ring pulse-ring-2"></div>
                <div class="pulse-ring pulse-ring-3"></div>
                <div class="pulse-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </div>
              </div>
              <div class="modal-banner-tag">OREPMI SATELLITE NETWORK</div>
            </div>

            <!-- Modal Body -->
            <div class="modal-card-body">
              <div class="modal-badge-wrapper">
                <span class="modal-status-badge">
                  <span class="badge-dot-orange"></span>
                  Bientôt disponible
                </span>
              </div>

              <h2 class="modal-headline">Bientôt disponible</h2>

              <p class="modal-subtext">
                La fonctionnalité d'ajout et d'appairage direct de balises GPS et trackers connectés sera disponible très prochainement sur votre espace Orepmi.
              </p>

              <div class="modal-features-list">
                <div class="modal-feature-row feature-row-stagger-1">
                  <div class="feature-icon-wrapper">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                    </svg>
                  </div>
                  <div class="feature-row-content">
                    <div class="feature-row-title">Appairage instantané</div>
                    <div class="feature-row-desc">Association rapide par Bluetooth Low Energy ou saisie d'identifiant IMEI.</div>
                  </div>
                </div>

                <div class="modal-feature-row feature-row-stagger-2">
                  <div class="feature-icon-wrapper">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  </div>
                  <div class="feature-row-content">
                    <div class="feature-row-title">Personnalisation des alertes</div>
                    <div class="feature-row-desc">Attribution par objet (vélo, valise, sac, véhicule) avec détection de mouvement.</div>
                  </div>
                </div>

                <div class="modal-feature-row feature-row-stagger-3">
                  <div class="feature-icon-wrapper">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <div class="feature-row-content">
                    <div class="feature-row-title">Sécurité Row Level Security (RLS)</div>
                    <div class="feature-row-desc">Toutes vos balises et coordonnées GPS restent privées et protégées dans Supabase.</div>
                  </div>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-white modal-btn-confirm btn-shimmer-interactive" @click="close">
                  <span class="btn-shimmer-sweep"></span>
                  <span>Compris</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { watch } from 'vue'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['update:open'])

function close() {
  emit('update:open', false)
}

watch(() => props.open, (val) => {
  document.body.classList.toggle('overflow-hidden', val)
})
</script>
