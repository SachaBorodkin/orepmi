import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'

import Home from '../views/Home.vue'
import Login from '../views/auth/Login.vue'
import Signup from '../views/auth/Signup.vue'
import Help from '../views/Help.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/login', name: 'login', component: Login },
  { path: '/signup', name: 'signup', component: Signup },
  { path: '/aide', name: 'help', component: Help },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Auth guard: redirect logged-in users away from auth pages
router.beforeEach(async (to) => {
  const { data: { session } } = await supabase.auth.getSession()
  const isAuthPage = to.name === 'login' || to.name === 'signup'

  if (session && isAuthPage) {
    return { name: 'home' }
  }
})

export default router
