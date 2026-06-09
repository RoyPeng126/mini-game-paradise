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
  scoreLabel: {
    type: String,
    default: 'Score',
  },
  bestLabel: {
    type: String,
    default: 'Best',
  },
  ariaLabel: {
    type: String,
    default: 'Game scores',
  },
})
</script>

<template>
  <div class="scoreboard" :aria-label="ariaLabel">
    <div class="score-box">
      <span>{{ scoreLabel }}</span>
      <strong>{{ score.toLocaleString() }}</strong>
    </div>
    <div class="score-box score-box--best">
      <span>{{ bestLabel }}</span>
      <strong>{{ bestScore.toLocaleString() }}</strong>
    </div>
  </div>
</template>
