<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useScoreStore } from '../../stores/scoreStore'
import {
  SYMBOLS,
  canSpin,
  resetSlotGame,
  spin,
} from './logic'

const REEL_STOP_TIMES = [800, 1100, 1400]
const LEVER_MAX_PULL = 32
const LEVER_TRIGGER_POINT = 28
const scoreStore = useScoreStore()
const gameState = ref(resetSlotGame())
const spinningReels = ref([false, false, false])
const stoppedReels = ref([true, true, true])
const finalReels = ref([])
const isLeverPulled = ref(false)
const leverPull = ref(0)
const isDraggingLever = ref(false)
const spinTimeouts = []
let leverStartY = 0
let leverPointerId = null

const storedBestWin = computed(() => scoreStore.getBestScore('slot'))
const isSpinning = computed(() => gameState.value.status === 'spinning')
const leverDisabled = computed(() => !canSpin(gameState.value))

const reelStrips = computed(() =>
  SYMBOLS.map((_, reelIndex) => {
    const offset = reelIndex * 2
    return Array.from(
      { length: 12 },
      (__, index) => SYMBOLS[(index + offset) % SYMBOLS.length],
    )
  }),
)

function stoppedStrip(index) {
  const symbol = finalReels.value[index] || gameState.value.reels[index]
  const symbolIndex = SYMBOLS.findIndex((item) => item.id === symbol.id)
  return [
    SYMBOLS[(symbolIndex - 1 + SYMBOLS.length) % SYMBOLS.length],
    symbol,
    SYMBOLS[(symbolIndex + 1) % SYMBOLS.length],
  ]
}

function schedule(callback, delay) {
  const timeout = window.setTimeout(callback, delay)
  spinTimeouts.push(timeout)
  return timeout
}

function clearSpinTimeouts() {
  spinTimeouts.forEach((timeout) => window.clearTimeout(timeout))
  spinTimeouts.length = 0
}

function setBet(nextBet) {
  if (isSpinning.value || gameState.value.credits < 5) return
  gameState.value = {
    ...gameState.value,
    bet: Math.max(5, Math.min(50, gameState.value.credits, nextBet)),
  }
}

function decreaseBet() {
  setBet(gameState.value.bet - 5)
}

function increaseBet() {
  setBet(gameState.value.bet + 5)
}

function maxBet() {
  setBet(Math.min(50, gameState.value.credits))
}

function stopReel(index) {
  spinningReels.value = spinningReels.value.map((spinning, reelIndex) =>
    reelIndex === index ? false : spinning,
  )
  stoppedReels.value = stoppedReels.value.map((stopped, reelIndex) =>
    reelIndex === index ? true : stopped,
  )
}

function finishSpin(finalState) {
  gameState.value = finalState
  scoreStore.updateBestScore('slot', finalState.bestWin)
}

function animateReels(finalState) {
  finalReels.value = finalState.reels
  spinningReels.value = [true, true, true]
  stoppedReels.value = [false, false, false]

  REEL_STOP_TIMES.forEach((delay, index) => {
    schedule(() => {
      stopReel(index)
      if (index === REEL_STOP_TIMES.length - 1) finishSpin(finalState)
    }, delay)
  })
}

function pullLeverAnimation() {
  isLeverPulled.value = true
  leverPull.value = LEVER_MAX_PULL
  schedule(() => {
    isLeverPulled.value = false
    leverPull.value = 0
  }, 320)
}

function handleSpinStart() {
  if (!canSpin(gameState.value)) return

  clearSpinTimeouts()
  const stateBeforeSpin = { ...gameState.value }
  const finalState = spin(stateBeforeSpin)

  gameState.value = {
    ...gameState.value,
    credits: gameState.value.credits - gameState.value.bet,
    lastWin: 0,
    totalSpins: gameState.value.totalSpins + 1,
    status: 'spinning',
    message: 'Reels spinning...',
  }

  pullLeverAnimation()
  animateReels(finalState)
}

function handleLeverPointerDown(event) {
  if (leverDisabled.value) return
  leverPointerId = event.pointerId
  leverStartY = event.clientY
  leverPull.value = 0
  isDraggingLever.value = true
}

function handleLeverPointerMove(event) {
  if (!isDraggingLever.value || event.pointerId !== leverPointerId) return

  if (event.pointerType === 'mouse' && event.buttons === 0) {
    handleLeverPointerCancel()
    return
  }

  leverPull.value = Math.max(
    0,
    Math.min(LEVER_MAX_PULL, event.clientY - leverStartY),
  )

  if (leverPull.value >= LEVER_TRIGGER_POINT) {
    isDraggingLever.value = false
    leverPointerId = null
    handleSpinStart()
  }
}

function handleLeverPointerUp(event) {
  if (!isDraggingLever.value || event.pointerId !== leverPointerId) return

  isDraggingLever.value = false
  leverPointerId = null
  leverPull.value = 0
}

function handleLeverPointerCancel() {
  isDraggingLever.value = false
  leverPointerId = null
  leverPull.value = 0
}

function resetGame() {
  clearSpinTimeouts()
  spinningReels.value = [false, false, false]
  stoppedReels.value = [true, true, true]
  finalReels.value = []
  isLeverPulled.value = false
  isDraggingLever.value = false
  leverPull.value = 0
  gameState.value = {
    ...resetSlotGame(),
    bestWin: storedBestWin.value,
  }
}

onMounted(() => {
  scoreStore.loadScores()
  gameState.value = {
    ...gameState.value,
    bestWin: storedBestWin.value,
  }
  window.addEventListener('pointermove', handleLeverPointerMove)
  window.addEventListener('pointerup', handleLeverPointerUp)
  window.addEventListener('pointercancel', handleLeverPointerCancel)
  window.addEventListener('blur', handleLeverPointerCancel)
})

onBeforeUnmount(() => {
  clearSpinTimeouts()
  window.removeEventListener('pointermove', handleLeverPointerMove)
  window.removeEventListener('pointerup', handleLeverPointerUp)
  window.removeEventListener('pointercancel', handleLeverPointerCancel)
  window.removeEventListener('blur', handleLeverPointerCancel)
})
</script>

<template>
  <div class="slot-page container">
    <div class="slot-nav">
      <RouterLink class="back-link" to="/">
        <span aria-hidden="true">←</span>
        Back to Home
      </RouterLink>
      <button
        class="button slot-reset"
        type="button"
        :disabled="isSpinning"
        @click="resetGame"
      >
        Reset Game
      </button>
    </div>

    <section class="slot-machine">
      <header class="slot-header">
        <span class="game-kicker">Just for fun · No real money</span>
        <h1>Slot Machine</h1>
        <p>Pull the lever or press Spin. Credits have no cash value.</p>
      </header>

      <div class="slot-stats">
        <div><span>Credits</span><strong>{{ gameState.credits }}</strong></div>
        <div><span>Bet</span><strong>{{ gameState.bet }}</strong></div>
        <div><span>Last Win</span><strong>{{ gameState.lastWin }}</strong></div>
        <div><span>Best Win</span><strong>{{ storedBestWin }}</strong></div>
        <div><span>Total Spins</span><strong>{{ gameState.totalSpins }}</strong></div>
      </div>

      <div
        class="slot-cabinet"
        :class="{
          'slot-cabinet--win': gameState.lastWin > 0 && !isSpinning,
          'slot-cabinet--spinning': isSpinning,
        }"
      >
        <div class="slot-cabinet__marquee">
          <i v-for="light in 14" :key="light"></i>
          <strong>Lucky Seven</strong>
        </div>

        <div class="slot-display">
          <div class="slot-reel-window" aria-label="Slot reels">
            <div
              v-for="(_, index) in 3"
              :key="index"
              class="slot-reel"
              :class="{
                'slot-reel-spinning': spinningReels[index],
                'slot-reel-stopped': stoppedReels[index] && finalReels.length > 0,
              }"
            >
              <div v-if="spinningReels[index]" class="slot-symbol-strip">
                <span
                  v-for="(symbol, symbolIndex) in reelStrips[index]"
                  :key="`${index}-${symbolIndex}`"
                >
                  {{ symbol.label }}
                </span>
              </div>
              <div v-else class="slot-symbol-strip slot-symbol-strip--stopped">
                <span
                  v-for="symbol in stoppedStrip(index)"
                  :key="`${index}-${symbol.id}`"
                >
                  {{ symbol.label }}
                </span>
              </div>
            </div>
          </div>

          <div
            class="slot-message"
            :class="{
              'slot-win': gameState.lastWin > 0 && !isSpinning,
              'slot-game-over': gameState.status === 'gameOver',
            }"
            role="status"
          >
            {{ gameState.message }}
          </div>
        </div>

        <div
          class="slot-lever-area"
          :class="{
            'slot-lever-area--pulled': isLeverPulled,
            'slot-lever-area--dragging': isDraggingLever,
            'slot-lever-area--disabled': leverDisabled,
          }"
          :style="{
            '--lever-shift': `${leverPull * 1.35}px`,
          }"
        >
          <button
            class="slot-lever"
            type="button"
            :disabled="leverDisabled"
            aria-label="Pull lever to spin"
            @pointerdown.prevent="handleLeverPointerDown"
          >
            <span class="slot-lever-base"></span>
            <span class="slot-lever-stick">
              <span class="slot-lever-arm"></span>
              <span class="slot-lever-knob"></span>
            </span>
          </button>
        </div>

        <div class="slot-control-panel">
          <div class="slot-bet-controls">
            <button
              type="button"
              :disabled="isSpinning || gameState.bet <= 5"
              @click="decreaseBet"
            >
              Bet −
            </button>
            <button
              type="button"
              :disabled="isSpinning || gameState.bet >= Math.min(50, gameState.credits)"
              @click="increaseBet"
            >
              Bet +
            </button>
            <button
              type="button"
              :disabled="isSpinning || gameState.credits < 5"
              @click="maxBet"
            >
              Max Bet
            </button>
          </div>

          <button
            class="slot-spin-button"
            type="button"
            :disabled="!canSpin(gameState)"
            @click="handleSpinStart"
          >
            {{ isSpinning ? 'Spinning...' : 'Spin' }}
          </button>
        </div>

        <div v-if="gameState.status === 'gameOver'" class="slot-game-over-panel">
          <strong>Out of credits</strong>
          <span>Reset the game to receive 100 new play credits.</span>
          <button class="button button--primary" type="button" @click="resetGame">
            Reset Game
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
