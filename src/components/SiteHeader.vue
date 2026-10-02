<template>
  <header class="site-header">
    <div class="header-container">
      <RouterLink to="/" class="logo-link" title="orepmi">
        <img src="/assets/images/logos/logo_with_name.svg" alt="orepmi" class="site-logo" />
      </RouterLink>

      <nav class="header-nav">
        <RouterLink to="/" class="nav-link">Mes Trackers</RouterLink>
        <RouterLink to="/aide" class="nav-link">Aide</RouterLink>

        <template v-if="user">
          <span class="user-name">{{ user.user_metadata?.name || user.email }}</span>
          <button class="btn-logout" @click="logout">Déconnexion</button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="btn-connexion">Connexion</RouterLink>
        </template>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { useAuth } from '../composables/useAuth'
import { supabase } from '../lib/supabase'
import { useRouter } from 'vue-router'

const { user } = useAuth()
const router = useRouter()

async function logout() {
  await supabase.auth.signOut()
  router.push('/login')
}
</script>
