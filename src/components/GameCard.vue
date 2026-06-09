<script setup>
defineProps({
  id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    validator: (value) => ['Playable', 'Coming Soon'].includes(value),
  },
  route: {
    type: String,
    default: '',
  },
  accent: {
    type: String,
    default: 'violet',
  },
  icon: {
    type: String,
    default: '✦',
  },
  playCount: {
    type: Number,
    default: 0,
  },
})

defineEmits(['play'])
</script>

<template>
  <article class="game-card" :class="`game-card--${accent}`">
    <div class="game-card__top">
      <div class="game-card__icon" aria-hidden="true">{{ icon }}</div>
      <span
        class="status-pill"
        :class="{ 'status-pill--soon': status === 'Coming Soon' }"
      >
        <span class="status-pill__dot"></span>
        {{ status }}
      </span>
    </div>

    <div class="game-card__content">
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
      <span class="game-play-count">
        {{
          playCount > 0
            ? `Played locally: ${playCount}`
            : 'Not played yet'
        }}
      </span>
    </div>

    <RouterLink
      v-if="status === 'Playable'"
      class="button button--card"
      :to="route"
      :aria-label="`Play ${title}`"
      @click="$emit('play', id)"
    >
      Play now
      <span aria-hidden="true">→</span>
    </RouterLink>
    <button v-else class="button button--card button--disabled" disabled>
      Coming soon
    </button>
  </article>
</template>
