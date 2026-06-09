<script setup>
import GameCard from '../components/GameCard.vue'

const games = [
  {
    title: '2048',
    description: 'Slide, merge, and think ahead. Can you reach the legendary 2048 tile?',
    status: 'Playable',
    route: '/2048',
    accent: 'amber',
    icon: '2048',
  },
  {
    title: 'Blackjack',
    description: 'Try to beat the dealer without going over 21.',
    status: 'Playable',
    route: '/blackjack',
    accent: 'green',
    icon: '21',
  },
  {
    title: 'Chrome Dino',
    description: 'Jump over obstacles and survive as the speed gets faster.',
    status: 'Playable',
    route: '/dino',
    accent: 'cyan',
    icon: 'DINO',
  },
  {
    title: 'Solitaire',
    description: 'Build each suit from Ace to King in this classic card game.',
    status: 'Playable',
    route: '/solitaire',
    accent: 'rose',
    icon: 'A♠',
  },
  {
    title: 'Mahjong',
    description: 'Play a simplified four-player Mahjong game against computer players.',
    status: 'Playable',
    route: '/mahjong',
    accent: 'amber',
    icon: '東',
  },
  {
    title: 'Snake',
    description: 'Grow longer, move faster, and avoid running into your own trail.',
    status: 'Coming Soon',
    accent: 'green',
    icon: 'S',
  },
  {
    title: 'Minesweeper',
    description: 'Use logic to clear the field without triggering a hidden mine.',
    status: 'Coming Soon',
    accent: 'orange',
    icon: '✹',
  },
  {
    title: 'Memory Card',
    description: 'Flip the cards, find every pair, and test your visual memory.',
    status: 'Coming Soon',
    accent: 'violet',
    icon: '◆',
  },
  {
    title: 'Tetris',
    description: 'Stack falling blocks, clear lines, and survive as long as possible.',
    status: 'Playable',
    route: '/tetris',
    accent: 'cyan',
    icon: '▦',
  },
  {
    title: 'Slot Machine',
    description: 'Spin the reels and try to hit the best symbol combo.',
    status: 'Playable',
    route: '/slot',
    accent: 'violet',
    icon: '7️⃣',
  },
]
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
        <p>Seven games ready to play. More classics are on the way.</p>
      </div>

      <div class="game-grid">
        <GameCard
          v-for="game in games"
          :key="game.title"
          v-bind="game"
        />
      </div>
    </section>
  </div>
</template>
