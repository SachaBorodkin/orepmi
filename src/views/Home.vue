<template>
  <div class="page-container">
    <!-- Authenticated Dashboard -->
    <template v-if="user">
      <div class="dashboard-header">
        <h1 class="dashboard-title">
          Bonjour {{ user.user_metadata?.name || user.user_metadata?.full_name || 'Utilisateur' }}
        </h1>
        <p class="dashboard-subtitle">Votre point de situation :</p>
      </div>

      <div class="trackers-grid">
        <TrackerCard />

        <div
          class="add-tracker-card"
          role="button"
          tabindex="0"
          @click="openTrackerModal()"
          @keydown.enter="openTrackerModal()"
        >
          <div class="add-icon">+</div>
          <div class="add-label">Ajouter un tracker</div>
        </div>
      </div>
    </template>

    <!-- Landing Page -->
    <template v-else>
      <section class="hero-section">
        <div class="hero-left">
          <span class="hero-tag">Suivi GPS - Anti-Vol</span>
          <h1 class="hero-title">Sachez toujours où<br />sont vos objets.</h1>
          <RouterLink to="/signup" class="hero-highlight-link">
            Ajoutez vos trackers ou votre téléphone et recevez les alerte en cas du vol
          </RouterLink>
          <div class="hero-actions">
            <RouterLink to="/signup" class="btn-white">Créer un compte</RouterLink>
            <a href="#comment-ca-marche" class="btn-ghost">Voir comment ça marche</a>
          </div>
        </div>

        <div class="hero-right">
          <div class="radar-widget">
            <div class="radar-grid"></div>

            <div class="radar-badge">
              <span class="badge-square"></span>
              MOUVEMENT DÉTECTÉ
            </div>

            <div class="radar-content">
              <svg class="radar-track-svg" viewBox="0 0 500 320" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M 50 280 C 150 270, 200 240, 260 210 C 310 185, 370 160, 440 90"
                  stroke="#475569"
                  stroke-width="1.5"
                  stroke-dasharray="4 4"
                />
              </svg>

              <div class="radar-point" style="left: 260px; top: 210px;">
                <div class="point-diamond"></div>
                <span style="color: #94a3b8; font-size: 11px;">VALISE — statique</span>
              </div>

              <div class="radar-point" style="left: 330px; top: 175px;">
                <div class="point-diamond"></div>
                <span style="color: #94a3b8; font-size: 11px;">SAC — statique</span>
              </div>

              <div class="radar-point" style="left: 440px; top: 90px;">
                <div class="point-orange">
                  <div class="point-pin-icon"></div>
                  <div class="point-pin-stem"></div>
                </div>
                <span style="color: var(--accent-orange); font-weight: 600; font-size: 11px; margin-left: 4px;">
                  VÉLO — il y a 2 min
                </span>
              </div>
            </div>

            <div class="radar-footer-count">3 TRACKERS ACTIFS</div>
          </div>
        </div>
      </section>

      <!-- Features Grid -->
      <section class="features-section" id="comment-ca-marche">
        <div class="feature-card">
          <div class="feature-number">01</div>
          <h3 class="feature-title">Position en temps réel</h3>
          <p class="feature-desc">Consultez la dernière position connue de chaque tracker, actualisée en continu.</p>
        </div>

        <div class="feature-card">
          <div class="feature-number">02</div>
          <h3 class="feature-title">Alertes de mouvement</h3>
          <p class="feature-desc">Recevez une notification dès qu'un objet "bloqué" se déplace.</p>
        </div>

        <div class="feature-card">
          <div class="feature-number">03</div>
          <h3 class="feature-title">Historique des trajets</h3>
          <p class="feature-desc">Retracez le parcours d'un objet sur les dernières 24 heures ou 30 jours.</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { useAuth } from '../composables/useAuth'
import TrackerCard from '../components/TrackerCard.vue'

const { user } = useAuth()
const openTrackerModal = inject('openTrackerModal')
</script>
