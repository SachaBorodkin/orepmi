<template>
  <div class="auth-page-wrapper">
    <div class="auth-card">
      <!-- Card Header -->
      <div class="auth-card-header">
        <RouterLink to="/" class="logo-link">
          <img src="/assets/images/logos/logo_with_name.svg" alt="orepmi" class="auth-logo" />
        </RouterLink>
        <RouterLink to="/" class="auth-close-btn" title="Fermer">&times;</RouterLink>
      </div>

      <!-- Map Banner -->
      <div class="auth-map-banner">
        <span class="map-coords">46.519°N, 6.632°E</span>
        <div class="point-orange">
          <div class="point-pin-icon"></div>
          <div class="point-pin-stem"></div>
        </div>
      </div>

      <!-- Card Body -->
      <div class="auth-card-body">
        <h2 class="auth-heading">Connectez-vous pour voir vos trackers</h2>
        <p class="auth-subtext">
          Vos objets restent localisés en arrière-plan — connectez-vous pour consulter leur position et leur historique.
        </p>

        <div v-if="errorMsg" class="alert-banner error alert-shake">{{ errorMsg }}</div>
        <div v-if="successMsg" class="alert-banner success">{{ successMsg }}</div>

        <form class="auth-form" @submit.prevent="handleLogin">
          <div class="form-group">
            <label for="email" class="form-label">EMAIL</label>
            <input
              type="email"
              id="email"
              name="email"
              class="form-input"
              v-model="email"
              placeholder="vous@exemple.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label for="password" class="form-label">MOT DE PASSE</label>
            <input
              type="password"
              id="password"
              name="password"
              class="form-input"
              v-model="password"
              placeholder="••••••••"
              required
              autocomplete="current-password"
            />
          </div>

          <button type="submit" class="btn-auth-submit" :disabled="loading">
            <span class="btn-shimmer-sweep"></span>
            <span v-if="loading" class="btn-spinner-wrapper">
              <svg class="btn-spinner" viewBox="0 0 24 24" fill="none">
                <circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
                <path class="spinner-head" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
              <span>Connexion en cours…</span>
            </span>
            <span v-else>Se connecter</span>
          </button>

          <div class="auth-footer-link">
            Pas de compte? <RouterLink to="/signup">Créer un compte</RouterLink>
          </div>
        </form>

        <!-- OAuth Divider -->
        <div class="auth-divider"><span>ou</span></div>

        <!-- Google OAuth -->
        <a href="#" class="btn-google" @click.prevent="handleGoogleLogin">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96l3.007 2.332C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Se connecter avec Google
        </a>
      </div>

      <!-- Card Footer -->
      <div class="auth-card-footer">
        <span class="auth-version">orepmi V1.0</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../lib/supabase'

const email = ref('')
const password = ref('')
const errorMsg = ref('')
const successMsg = ref('')
const loading = ref(false)
const router = useRouter()

async function handleLogin() {
  loading.value = true
  errorMsg.value = ''
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (error) {
    errorMsg.value = error.message
  } else {
    router.push('/')
  }
}

async function handleGoogleLogin() {
  const redirectTo = import.meta.env.VITE_REDIRECT_URL || 'https://orepmi67.vercel.app/'
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}
</script>
