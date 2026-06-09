<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getGameClickCounts,
  getLocalVisitCount,
  incrementLocalVisitCount,
  subscribeToAnalyticsUpdates,
} from '../utils/analytics'

const localVisits = ref(0)
const gameClickCounts = ref({})
let unsubscribeAnalytics = null

const gamesPlayedLocally = computed(() =>
  Object.values(gameClickCounts.value).reduce(
    (total, count) => total + (Number(count) || 0),
    0,
  ),
)

function refreshAnalytics() {
  localVisits.value = getLocalVisitCount()
  gameClickCounts.value = getGameClickCounts()
}

onMounted(() => {
  unsubscribeAnalytics = subscribeToAnalyticsUpdates(refreshAnalytics)
  incrementLocalVisitCount()
  refreshAnalytics()
})

onBeforeUnmount(() => {
  unsubscribeAnalytics?.()
})
</script>

<template>
  <footer class="app-footer">
    <div class="app-footer-content container">
      <div>
        <strong>Mini Game Paradise</strong>
        <p>Built with Vue 3, Vite, Pinia, and Vue Router.</p>
      </div>

      <div class="app-footer-stats" aria-label="Local platform analytics">
        <span>Local visits: {{ localVisits }}</span>
        <span>Games played locally: {{ gamesPlayedLocally }}</span>
      </div>

      <small class="app-footer-note">
        Global analytics will start after deployment.
      </small>
    </div>
  </footer>
</template>
