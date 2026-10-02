import { ref, computed } from 'vue'
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

// Extract avatar URL from Google OAuth or user metadata
const userAvatar = computed(() => {
  if (!user.value) return null
  const meta = user.value.user_metadata || {}

  // Direct metadata (Google OAuth sets both picture and avatar_url)
  if (meta.avatar_url) return meta.avatar_url
  if (meta.picture) return meta.picture
  if (meta.avatar) return meta.avatar

  // Identities metadata fallback
  if (Array.isArray(user.value.identities)) {
    for (const identity of user.value.identities) {
      const idData = identity.identity_data || {}
      if (idData.avatar_url) return idData.avatar_url
      if (idData.picture) return idData.picture
    }
  }

  return null
})

// Display name
const userName = computed(() => {
  if (!user.value) return ''
  const meta = user.value.user_metadata || {}
  return meta.name || meta.full_name || user.value.email?.split('@')[0] || 'Utilisateur'
})

// Avatar initials fallback
const userInitials = computed(() => {
  const name = userName.value
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
})

// Helper to upload a custom avatar into the Supabase "avatars" bucket
async function uploadAvatar(file) {
  if (!user.value) throw new Error('Utilisateur non connecté')

  const fileExt = file.name.split('.').pop()
  const filePath = `${user.value.id}/${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  // Update user metadata with new avatar_url
  const { error: updateError } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl },
  })

  if (updateError) throw updateError
  return publicUrl
}

export function useAuth() {
  return {
    user,
    loading,
    userAvatar,
    userName,
    userInitials,
    uploadAvatar,
  }
}

