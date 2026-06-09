<script setup>
import Game2048 from '../games/game2048/Game2048.vue'
</script>

<template>
  <div class="game-view container">
    <RouterLink class="back-link" to="/">
      <span aria-hidden="true">←</span>
      Back to games
    </RouterLink>
    <Game2048 />
  </div>
</template>
