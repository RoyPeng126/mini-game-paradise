<script setup>
defineProps({
  score: {
    type: Number,
    required: true,
  },
  bestScore: {
    type: Number,
    required: true,
  },
})
</script>

<template>
  <div class="scoreboard" aria-label="Game scores">
    <div class="score-box">
      <span>Score</span>
      <strong>{{ score.toLocaleString() }}</strong>
    </div>
    <div class="score-box score-box--best">
      <span>Best</span>
      <strong>{{ bestScore.toLocaleString() }}</strong>
    </div>
  </div>
</template>
