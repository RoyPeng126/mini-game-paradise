<script setup>
defineProps({
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
})
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
    </div>

    <RouterLink
      v-if="status === 'Playable'"
      class="button button--card"
      :to="route"
      :aria-label="`Play ${title}`"
    >
      Play now
      <span aria-hidden="true">→</span>
    </RouterLink>
    <button v-else class="button button--card button--disabled" disabled>
      Coming soon
    </button>
  </article>
</template>
