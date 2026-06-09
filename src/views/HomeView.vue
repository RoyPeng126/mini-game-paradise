<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import GameCard from '../components/GameCard.vue'
import {
  addRecentlyPlayedGame,
  getGameClickCounts,
  incrementGameClickCount,
  sortGamesByAnalytics,
  subscribeToAnalyticsUpdates,
} from '../utils/analytics'

const games = [
  {
    id: '2048',
    title: '2048',
    description: 'Slide, merge, and think ahead. Can you reach the legendary 2048 tile?',
    status: 'Playable',
    route: '/2048',
    accent: 'amber',
    icon: '2048',
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    description: 'Try to beat the dealer without going over 21.',
    status: 'Playable',
    route: '/blackjack',
    accent: 'green',
    icon: '21',
  },
  {
    id: 'dino',
    title: 'Chrome Dino',
    description: 'Jump over obstacles and survive as the speed gets faster.',
    status: 'Playable',
    route: '/dino',
    accent: 'cyan',
    icon: 'DINO',
  },
  {
    id: 'solitaire',
    title: 'Solitaire',
    description: 'Build each suit from Ace to King in this classic card game.',
    status: 'Playable',
    route: '/solitaire',
    accent: 'rose',
    icon: 'A♠',
  },
  {
    id: 'mahjong',
    title: 'Mahjong',
    description: 'Play a simplified four-player Mahjong game against computer players.',
    status: 'Playable',
    route: '/mahjong',
    accent: 'amber',
    icon: '東',
  },
  {
    id: 'snake',
    title: 'Snake',
    description: 'Grow longer, move faster, and avoid running into your own trail.',
    status: 'Coming Soon',
    accent: 'green',
    icon: 'S',
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper',
    description: 'Use logic to clear the field without triggering a hidden mine.',
    status: 'Playable',
    route: '/minesweeper',
    accent: 'orange',
    icon: '✹',
  },
  {
    id: 'pathzip',
    title: 'Path Zip',
    description: 'Draw one continuous path through every cell while visiting numbers in order.',
    status: 'Playable',
    route: '/pathzip',
    accent: 'violet',
    icon: '1→',
  },
  {
    id: 'patchgrid',
    title: 'Patch Grid',
    description: 'Divide the board into rectangular patches that match each clue.',
    status: 'Playable',
    route: '/patchgrid',
    accent: 'cyan',
    icon: '▤',
  },
  {
    id: 'memory',
    title: 'Memory Card',
    description: 'Flip the cards, find every pair, and test your visual memory.',
    status: 'Coming Soon',
    accent: 'violet',
    icon: '◆',
  },
  {
    id: 'tetris',
    title: 'Tetris',
    description: 'Stack falling blocks, clear lines, and survive as long as possible.',
    status: 'Playable',
    route: '/tetris',
    accent: 'cyan',
    icon: '▦',
  },
  {
    id: 'slot',
    title: 'Slot Machine',
    description: 'Spin the reels and try to hit the best symbol combo.',
    status: 'Playable',
    route: '/slot',
    accent: 'violet',
    icon: '7️⃣',
  },
]

const sortMode = ref('default')
const clickCounts = ref({})
let unsubscribeAnalytics = null

const sortedGames = computed(() => {
  clickCounts.value
  return sortGamesByAnalytics(games, sortMode.value)
})

function refreshAnalytics() {
  clickCounts.value = getGameClickCounts()
}

function trackGamePlay(gameId) {
  incrementGameClickCount(gameId)
  addRecentlyPlayedGame(gameId)
  refreshAnalytics()
}

onMounted(() => {
  refreshAnalytics()
  unsubscribeAnalytics = subscribeToAnalyticsUpdates(refreshAnalytics)
})

onBeforeUnmount(() => {
  unsubscribeAnalytics?.()
})
</script>

<template>
  <div class="home-view">
    <section class="hero container">
      <div class="hero__eyebrow">
        <span></span>
        Your pocket-sized arcade
      </div>
      <h1>Mini Game <span>Paradise.</span></h1>
      <p>Play classic mini games in one place.</p>
      <a class="button button--primary" href="#games">
        Explore games
        <span aria-hidden="true">↓</span>
      </a>

      <div class="hero__glow hero__glow--one"></div>
      <div class="hero__glow hero__glow--two"></div>
    </section>

    <section id="games" class="games-section container">
      <div class="section-heading">
        <div>
          <span class="section-heading__label">Game library</span>
          <h2>Pick your next challenge</h2>
        </div>
        <p>Ten games ready to play. More classics are on the way.</p>
      </div>

      <div class="home-sort-bar">
        <span>Local play data only</span>
        <label>
          Sort by
          <select
            v-model="sortMode"
            class="game-sort-select"
            aria-label="Sort games"
          >
            <option value="default">Default</option>
            <option value="mostPlayed">Most Played</option>
            <option value="recentlyPlayed">Recently Played</option>
            <option value="alphabetical">A-Z</option>
          </select>
        </label>
      </div>

      <div class="game-grid">
        <GameCard
          v-for="game in sortedGames"
          :key="game.id"
          v-bind="game"
          :play-count="clickCounts[game.id] ?? 0"
          @play="trackGamePlay"
        />
      </div>
    </section>
  </div>
</template>
