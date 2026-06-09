<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ScoreBoard from '../../components/ScoreBoard.vue'
import { useScoreStore } from '../../stores/scoreStore'
import {
  jump,
  resetDinoGame,
  updateGameState,
} from './logic'

const scoreStore = useScoreStore()
const gameState = ref(resetDinoGame())
let animationFrame = null
let lastTimestamp = null

const displayScore = computed(() => Math.floor(gameState.value.score))
const bestScore = computed(() => scoreStore.getBestScore('dino'))

function entityStyle(entity) {
  return {
    left: `${(entity.x / gameState.value.gameWidth) * 100}%`,
    top: `${(entity.y / gameState.value.gameHeight) * 100}%`,
    width: `${(entity.width / gameState.value.gameWidth) * 100}%`,
    height: `${(entity.height / gameState.value.gameHeight) * 100}%`,
  }
}

function updateBestScore() {
  scoreStore.updateBestScore('dino', displayScore.value)
}

function startOrJump() {
  if (gameState.value.status === 'gameOver') {
    gameState.value = {
      ...resetDinoGame(),
      status: 'playing',
    }
  }

  if (gameState.value.status === 'paused') return
  gameState.value = jump(gameState.value)
}

function restart() {
  gameState.value = resetDinoGame()
  lastTimestamp = null
}

function togglePause() {
  if (!['playing', 'paused'].includes(gameState.value.status)) return

  gameState.value = {
    ...gameState.value,
    status: gameState.value.status === 'paused' ? 'playing' : 'paused',
  }
  lastTimestamp = null
}

function handleKeydown(event) {
  if (
    event.code !== 'Space' &&
    event.key !== 'ArrowUp' &&
    event.key.toLowerCase() !== 'p'
  ) {
    return
  }

  event.preventDefault()
  if (event.key.toLowerCase() === 'p') {
    togglePause()
    return
  }
  startOrJump()
}

function gameLoop(timestamp) {
  if (lastTimestamp === null) lastTimestamp = timestamp
  const deltaTime = timestamp - lastTimestamp
  lastTimestamp = timestamp

  if (gameState.value.status === 'playing') {
    gameState.value = updateGameState(gameState.value, deltaTime)
    updateBestScore()
  }

  animationFrame = window.requestAnimationFrame(gameLoop)
}

onMounted(() => {
  scoreStore.loadScores()
  window.addEventListener('keydown', handleKeydown)
  animationFrame = window.requestAnimationFrame(gameLoop)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <div class="dino-page container">
    <div class="dino-nav">
      <RouterLink class="back-link" to="/">
        <span aria-hidden="true">←</span>
        Back to Home
      </RouterLink>
      <button class="button dino-restart" type="button" @click="restart">
        Restart
      </button>
    </div>

    <section class="dino-layout">
      <header class="dino-header">
        <div>
          <span class="game-kicker">Endless runner</span>
          <h1>Dino Runner</h1>
          <p>Jump over obstacles and survive as the speed gets faster.</p>
          <p class="dino-dragon-note">
            Flying dragons appear after 200 points.
          </p>
        </div>
        <ScoreBoard :score="displayScore" :best-score="bestScore" />
      </header>

      <div class="dino-score-panel">
        <div>
          <span>Speed</span>
          <strong>{{ gameState.speed.toFixed(1) }}x</strong>
        </div>
        <div>
          <span>Distance</span>
          <strong>{{ Math.floor(gameState.distance) }}m</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{{ gameState.status }}</strong>
        </div>
      </div>

      <div
        class="dino-game-area"
        role="application"
        aria-label="Dino Runner game area"
        @pointerdown="startOrJump"
      >
        <div
          class="dino-ground"
          :style="{ top: `${(gameState.groundY / gameState.gameHeight) * 100}%` }"
        ></div>

        <div
          class="dino-character"
          :class="{ 'dino-character--running': gameState.status === 'playing' && !gameState.dino.isJumping }"
          :style="entityStyle(gameState.dino)"
          aria-label="Dino"
        >
          <span class="dino-character__eye"></span>
          <span class="dino-character__legs"></span>
        </div>

        <div
          v-for="obstacle in gameState.obstacles"
          :key="obstacle.id"
          class="dino-obstacle"
          :class="[
            obstacle.type === 'flyingDragon'
              ? 'dino-obstacle-flying-dragon'
              : 'dino-obstacle-cactus',
            obstacle.type === 'flyingDragon'
              ? `dino-dragon-${obstacle.variant}`
              : `dino-cactus-${obstacle.variant}`,
          ]"
          :style="entityStyle(obstacle)"
          :aria-label="
            obstacle.type === 'flyingDragon'
              ? `${obstacle.variant} Flying Dragon obstacle`
              : 'Cactus obstacle'
          "
        >
          <template v-if="obstacle.type === 'flyingDragon'">
            <span class="dino-dragon-body"></span>
            <span class="dino-dragon-wing dino-dragon-flap"></span>
            <span class="dino-dragon-tail"></span>
          </template>
        </div>

        <div v-if="gameState.status === 'ready'" class="dino-ready-message">
          <span>Ready?</span>
          <strong>Press Space to Start</strong>
          <small>or tap the game area</small>
        </div>

        <div v-else-if="gameState.status === 'paused'" class="dino-ready-message">
          <span>Take a breath</span>
          <strong>Paused</strong>
          <button class="button button--primary" type="button" @click.stop="togglePause">
            Continue
          </button>
        </div>

        <div v-else-if="gameState.status === 'gameOver'" class="dino-game-over">
          <span>Final score · {{ displayScore }}</span>
          <strong>Game Over</strong>
          <button class="button button--primary" type="button" @click.stop="restart">
            Restart
          </button>
        </div>
      </div>

      <div class="dino-controls">
        <p><kbd>Space</kbd> / <kbd>↑</kbd> Jump</p>
        <p><kbd>P</kbd> Pause or resume</p>
      </div>

      <div class="dino-mobile-controls" aria-label="Dino controls">
        <button type="button" @click="startOrJump">
          ↑
          <small>Jump</small>
        </button>
        <button
          type="button"
          :disabled="!['playing', 'paused'].includes(gameState.status)"
          @click="togglePause"
        >
          {{ gameState.status === 'paused' ? '▶' : 'Ⅱ' }}
          <small>{{ gameState.status === 'paused' ? 'Resume' : 'Pause' }}</small>
        </button>
        <button type="button" @click="restart">
          ↻
          <small>Restart</small>
        </button>
      </div>
    </section>
  </div>
</template>
