<template>
  <header class="site-header" @dragstart.prevent @dragover.prevent>
    <div class="header-container">
      <RouterLink to="/" class="logo-link" title="orepmi" draggable="false">
        <img src="/assets/images/logos/logo_with_name.svg" alt="orepmi" class="site-logo" draggable="false" />
      </RouterLink>

      <!-- Desktop nav -->
      <nav class="header-nav">
        <RouterLink to="/" class="nav-link" draggable="false">Mes Trackers</RouterLink>
        <RouterLink to="/aide" class="nav-link" draggable="false">Aide</RouterLink>

        <template v-if="user">
          <div class="user-profile-badge">
            <div class="user-avatar-wrapper">
              <img
                v-if="userAvatar && !avatarError"
                :src="userAvatar"
                :alt="userName"
                class="user-avatar-img"
                @error="avatarError = true"
                referrerpolicy="no-referrer"
                draggable="false"
              />
              <span v-else class="user-avatar-initial">{{ userInitials }}</span>
            </div>
            <span class="user-name">{{ userName }}</span>
          </div>
          <button class="btn-logout" @click="logout" title="Se déconnecter" aria-label="Déconnexion">
            <svg class="logout-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Déconnexion</span>
          </button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn-connexion btn-shimmer-interactive" draggable="false">
            <span class="btn-shimmer-sweep"></span>
            <span>Connexion</span>
          </RouterLink>
        </template>
      </nav>

      <!-- Hamburger button (mobile only) -->
      <button
        class="hamburger-btn"
        :class="{ 'is-open': mobileMenuOpen }"
        @click="mobileMenuOpen = !mobileMenuOpen"
        :aria-expanded="mobileMenuOpen"
        aria-label="Menu"
      >
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </button>
    </div>

    <!-- Mobile drawer overlay -->
    <Transition name="drawer-fade">
      <div
        v-if="mobileMenuOpen"
        class="mobile-overlay"
        @click="mobileMenuOpen = false"
      ></div>
    </Transition>

    <!-- Mobile drawer -->
    <Transition name="drawer-slide">
      <div v-if="mobileMenuOpen" class="mobile-drawer" @keydown.escape="mobileMenuOpen = false">
        <div class="mobile-drawer-header">
          <RouterLink to="/" class="logo-link" @click="mobileMenuOpen = false">
            <img src="/assets/images/logos/logo_with_name.svg" alt="orepmi" class="site-logo" draggable="false" />
          </RouterLink>
          <button class="drawer-close-btn" @click="mobileMenuOpen = false" aria-label="Fermer le menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <nav class="mobile-nav">
          <RouterLink to="/" class="mobile-nav-link" @click="mobileMenuOpen = false" draggable="false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Mes Trackers
          </RouterLink>
          <RouterLink to="/aide" class="mobile-nav-link" @click="mobileMenuOpen = false" draggable="false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Aide
          </RouterLink>
        </nav>

        <div class="mobile-drawer-footer">
          <template v-if="user">
            <div class="mobile-user-info">
              <div class="mobile-user-avatar">
                <img
                  v-if="userAvatar && !mobileAvatarError"
                  :src="userAvatar"
                  :alt="userName"
                  class="user-avatar-img"
                  @error="mobileAvatarError = true"
                  referrerpolicy="no-referrer"
                  draggable="false"
                />
                <span v-else class="user-avatar-initial">{{ userInitials }}</span>
              </div>
              <div class="mobile-user-details">
                <span class="mobile-user-name">{{ userName }}</span>
                <span class="mobile-user-email">{{ user.email }}</span>
              </div>
            </div>
            <button class="btn-logout mobile-logout-btn" @click="logout" title="Se déconnecter" aria-label="Déconnexion">
              <svg class="logout-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Déconnexion</span>
            </button>
          </template>
          <template v-else>
            <RouterLink to="/login" class="btn-white mobile-login-btn" @click="mobileMenuOpen = false" draggable="false">
              Connexion
            </RouterLink>
            <RouterLink to="/signup" class="mobile-signup-link" @click="mobileMenuOpen = false" draggable="false">
              Créer un compte →
            </RouterLink>
          </template>
        </div>
      </div>
    </Transition>
  </header>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { supabase } from '../lib/supabase'
import { useRouter } from 'vue-router'

const { user, userAvatar, userName, userInitials } = useAuth()
const router = useRouter()
const mobileMenuOpen = ref(false)
const avatarError = ref(false)
const mobileAvatarError = ref(false)

async function logout() {
  mobileMenuOpen.value = false
  await supabase.auth.signOut()
  router.push('/login')
}
</script>

