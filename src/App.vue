<script setup>
import Navbar from './components/Navbar.vue'
</script>

<template>
  <div class="app-shell">
    <Navbar />
    <main>
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <footer class="site-footer">
      <span>Mini Game Paradise</span>
      <span>Built with Vue 3</span>
    </footer>
  </div>
</template>
