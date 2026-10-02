<template>
  <div id="app-shell">
    <SiteHeader />
    <main>
      <RouterView />
    </main>
    <SiteFooter />
    <AddTrackerModal v-model:open="trackerModalOpen" />
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import SiteHeader from './components/SiteHeader.vue'
import SiteFooter from './components/SiteFooter.vue'
import AddTrackerModal from './components/AddTrackerModal.vue'

const trackerModalOpen = ref(false)
provide('openTrackerModal', () => { trackerModalOpen.value = true })
</script>
