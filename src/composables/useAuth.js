import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const user = ref(null)
const loading = ref(true)

// Initialize: get current session
supabase.auth.getSession().then(({ data: { session } }) => {
  user.value = session?.user ?? null
  loading.value = false
})

// Listen to auth changes
supabase.auth.onAuthStateChange((_event, session) => {
  user.value = session?.user ?? null
})

export function useAuth() {
  return { user, loading }
}
