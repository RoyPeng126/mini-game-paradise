<script setup>
import Navbar from './components/Navbar.vue'
import AppFooter from './components/AppFooter.vue'
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
    <AppFooter />
  </div>
</template>
