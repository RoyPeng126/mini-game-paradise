<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useScoreStore } from '../../stores/scoreStore'
import {
  DIFFICULTIES,
  getRemainingFlags,
  resetMinesweeperGame,
  revealCell,
  toggleFlag,
} from './logic'

const scoreStore = useScoreStore()
const gameState = ref(resetMinesweeperGame())
const flagMode = ref(false)
let timerInterval = null

const difficultyOptions = Object.entries(DIFFICULTIES).map(
  ([value, config]) => ({
    value,
    label: value[0].toUpperCase() + value.slice(1),
    detail: `${config.rows} × ${config.cols} · ${config.mines} mines`,
  }),
)

const remainingFlags = computed(() => getRemainingFlags(gameState.value))
const bestTimeKey = computed(
  () => `minesweeper-${gameState.value.difficulty}`,
)
const bestTime = computed(() => scoreStore.getBestTime(bestTimeKey.value))
const boardStyle = computed(() => ({
  '--minesweeper-cols': gameState.value.cols,
  '--minesweeper-cell-size':
    gameState.value.difficulty === 'easy'
      ? '42px'
      : gameState.value.difficulty === 'medium'
        ? '32px'
        : '28px',
}))

const statusContent = computed(() => {
  const content = {
    ready: {
      label: 'Ready',
      message: 'Choose a cell to begin. Your first click is always safe.',
    },
    playing: {
      label: 'Clearing',
      message: 'Use the numbers to locate every hidden mine.',
    },
    won: {
      label: 'Field cleared',
      message: `Completed in ${formatTime(gameState.value.elapsedTime)}.`,
    },
    lost: {
      label: 'Mine triggered',
      message: 'The field was not cleared. Restart and try another route.',
    },
  }

  return content[gameState.value.status]
})

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`
}

function restart(difficulty = gameState.value.difficulty) {
  stopTimer()
  gameState.value = resetMinesweeperGame(difficulty)
  flagMode.value = false
}

function changeDifficulty(event) {
  restart(event.target.value)
}

function interactWithCell(row, col) {
  if (flagMode.value) {
    gameState.value = toggleFlag(gameState.value, row, col)
    return
  }

  gameState.value = revealCell(gameState.value, row, col)
}

function flagCell(row, col) {
  gameState.value = toggleFlag(gameState.value, row, col)
}

function startTimer() {
  if (timerInterval) return

  timerInterval = window.setInterval(() => {
    if (gameState.value.status === 'playing') {
      gameState.value = {
        ...gameState.value,
        elapsedTime: gameState.value.elapsedTime + 1,
      }
    }
  }, 1000)
}

function stopTimer() {
  if (!timerInterval) return
  window.clearInterval(timerInterval)
  timerInterval = null
}

function cellContent(cell) {
  if (cell.isFlagged && !cell.isRevealed) return '⚑'
  if (!cell.isRevealed) return ''
  if (cell.isMine) return '✹'
  return cell.adjacentMines || ''
}

function cellLabel(cell) {
  if (cell.isFlagged && !cell.isRevealed) {
    return `Row ${cell.row + 1}, column ${cell.col + 1}, flagged`
  }
  if (!cell.isRevealed) {
    return `Row ${cell.row + 1}, column ${cell.col + 1}, hidden`
  }
  if (cell.isMine) {
    return `Row ${cell.row + 1}, column ${cell.col + 1}, mine`
  }
  return `Row ${cell.row + 1}, column ${cell.col + 1}, ${
    cell.adjacentMines
  } adjacent mines`
}

watch(
  () => gameState.value.status,
  (status, previousStatus) => {
    if (status === 'playing' && previousStatus !== 'playing') {
      startTimer()
    }

    if (['won', 'lost'].includes(status)) {
      stopTimer()
    }

    if (status === 'won') {
      scoreStore.updateBestTime(
        bestTimeKey.value,
        gameState.value.elapsedTime,
      )
    }
  },
)

onMounted(() => {
  scoreStore.loadScores()
})

onBeforeUnmount(() => {
  stopTimer()
})
</script>

<template>
  <div class="minesweeper-page container">
    <div class="minesweeper-nav">
      <RouterLink class="back-link" to="/">
        <span aria-hidden="true">←</span>
        Back to Home
      </RouterLink>
      <button
        class="button minesweeper-restart"
        type="button"
        @click="restart()"
      >
        <span aria-hidden="true">↻</span>
        Restart
      </button>
    </div>

    <section class="minesweeper">
      <header class="minesweeper__header">
        <div>
          <span class="game-kicker">Logic puzzle</span>
          <h1>Minesweeper</h1>
          <p>Clear every safe cell without triggering a hidden mine.</p>
        </div>

        <label class="minesweeper-difficulty">
          <span>Difficulty</span>
          <select
            :value="gameState.difficulty"
            aria-label="Minesweeper difficulty"
            @change="changeDifficulty"
          >
            <option
              v-for="option in difficultyOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }} · {{ option.detail }}
            </option>
          </select>
        </label>
      </header>

      <div class="minesweeper-stats" aria-label="Minesweeper game status">
        <div>
          <span>Timer</span>
          <strong>{{ formatTime(gameState.elapsedTime) }}</strong>
        </div>
        <div>
          <span>Flags left</span>
          <strong>{{ remainingFlags }}</strong>
        </div>
        <div>
          <span>Best time</span>
          <strong>{{ bestTime ? formatTime(bestTime) : '--:--' }}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{{ statusContent.label }}</strong>
        </div>
      </div>

      <div class="minesweeper-toolbar">
        <p>{{ statusContent.message }}</p>
        <button
          class="minesweeper-flag-mode"
          :class="{ 'minesweeper-flag-mode--active': flagMode }"
          type="button"
          :aria-pressed="flagMode"
          @click="flagMode = !flagMode"
        >
          <span aria-hidden="true">⚑</span>
          Flag Mode {{ flagMode ? 'ON' : 'OFF' }}
        </button>
      </div>

      <div class="minesweeper-board-shell">
        <div
          class="minesweeper-board"
          :class="`minesweeper-board--${gameState.difficulty}`"
          :style="boardStyle"
          role="grid"
          :aria-label="`${gameState.difficulty} Minesweeper board`"
        >
          <template v-for="row in gameState.board" :key="row[0].row">
            <button
              v-for="cell in row"
              :key="`${cell.row}-${cell.col}`"
              class="minesweeper-cell"
              :class="{
                'minesweeper-cell--revealed': cell.isRevealed,
                'minesweeper-cell--mine': cell.isRevealed && cell.isMine,
                'minesweeper-cell--flagged':
                  cell.isFlagged && !cell.isRevealed,
                [`minesweeper-cell--number-${cell.adjacentMines}`]:
                  cell.isRevealed && !cell.isMine && cell.adjacentMines > 0,
              }"
              type="button"
              role="gridcell"
              :aria-label="cellLabel(cell)"
              :disabled="['won', 'lost'].includes(gameState.status)"
              @click="interactWithCell(cell.row, cell.col)"
              @contextmenu.prevent="flagCell(cell.row, cell.col)"
            >
              {{ cellContent(cell) }}
            </button>
          </template>
        </div>

        <div
          v-if="['won', 'lost'].includes(gameState.status)"
          class="minesweeper-result"
          aria-live="polite"
        >
          <span>
            {{ gameState.status === 'won' ? 'Puzzle complete' : 'Game over' }}
          </span>
          <h2>{{ statusContent.label }}</h2>
          <p>{{ statusContent.message }}</p>
          <button
            class="button button--primary"
            type="button"
            @click="restart()"
          >
            Play again
          </button>
        </div>
      </div>

      <p class="minesweeper-help">
        Left click or tap to reveal. Right click or enable Flag Mode to place
        flags.
      </p>
    </section>
  </div>
</template>
