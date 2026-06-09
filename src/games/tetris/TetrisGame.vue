<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ScoreBoard from '../../components/ScoreBoard.vue'
import { useScoreStore } from '../../stores/scoreStore'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createInitialTetrisGame,
  hardDrop,
  movePiece,
  rotateCurrentPiece,
  softDrop,
  tick,
} from './logic'

const scoreStore = useScoreStore()
const gameState = ref(createInitialTetrisGame())
let dropTimer = null

const bestScore = computed(() => scoreStore.getBestScore('tetris'))
const dropInterval = computed(() =>
  Math.max(110, 760 - (gameState.value.level - 1) * 65),
)

const displayBoard = computed(() => {
  const board = gameState.value.board.map((row) => [...row])
  const piece = gameState.value.currentPiece
  if (!piece || gameState.value.status === 'gameOver') return board

  piece.shape.forEach((row, rowIndex) => {
    row.forEach((filled, columnIndex) => {
      if (!filled) return
      const boardRow = gameState.value.position.row + rowIndex
      const boardColumn = gameState.value.position.col + columnIndex
      if (
        boardRow >= 0 &&
        boardRow < BOARD_HEIGHT &&
        boardColumn >= 0 &&
        boardColumn < BOARD_WIDTH
      ) {
        board[boardRow][boardColumn] = piece.type
      }
    })
  })
  return board
})

const nextPreview = computed(() => {
  const preview = Array.from({ length: 4 }, () => Array(4).fill(null))
  const piece = gameState.value.nextPiece
  if (!piece) return preview

  const rowOffset = Math.floor((4 - piece.shape.length) / 2)
  const columnOffset = Math.floor((4 - piece.shape[0].length) / 2)
  piece.shape.forEach((row, rowIndex) => {
    row.forEach((filled, columnIndex) => {
      if (filled) {
        preview[rowOffset + rowIndex][columnOffset + columnIndex] = piece.type
      }
    })
  })
  return preview
})

function applyState(nextState) {
  gameState.value = nextState
  scoreStore.updateBestScore('tetris', nextState.score)
}

function scheduleDrop() {
  window.clearTimeout(dropTimer)
  if (gameState.value.status !== 'playing') return

  dropTimer = window.setTimeout(() => {
    applyState(tick(gameState.value))
    scheduleDrop()
  }, dropInterval.value)
}

function restart() {
  applyState(createInitialTetrisGame())
  scheduleDrop()
}

function move(direction) {
  applyState(movePiece(gameState.value, direction))
}

function rotate() {
  applyState(rotateCurrentPiece(gameState.value))
}

function dropSoft() {
  applyState(softDrop(gameState.value))
}

function dropHard() {
  applyState(hardDrop(gameState.value))
  scheduleDrop()
}

function togglePause() {
  if (gameState.value.status === 'gameOver') return
  gameState.value = {
    ...gameState.value,
    status: gameState.value.status === 'paused' ? 'playing' : 'paused',
  }
  scheduleDrop()
}

function handleKeydown(event) {
  const handledKeys = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowDown',
    'ArrowUp',
    ' ',
    'p',
    'P',
  ]
  if (!handledKeys.includes(event.key)) return
  event.preventDefault()

  if (event.key === 'p' || event.key === 'P') {
    togglePause()
    return
  }
  if (gameState.value.status !== 'playing') return

  if (event.key === 'ArrowLeft') move('left')
  if (event.key === 'ArrowRight') move('right')
  if (event.key === 'ArrowDown') dropSoft()
  if (event.key === 'ArrowUp') rotate()
  if (event.key === ' ') dropHard()
}

function cellClass(value) {
  return value ? [`tetris-cell-filled`, `tetris-cell-${value}`] : ''
}

onMounted(() => {
  scoreStore.loadScores()
  window.addEventListener('keydown', handleKeydown)
  scheduleDrop()
})

onBeforeUnmount(() => {
  window.clearTimeout(dropTimer)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="tetris-page container">
    <div class="tetris-nav">
      <RouterLink class="back-link" to="/">
        <span aria-hidden="true">←</span>
        Back to Home
      </RouterLink>
      <button class="button tetris-restart" type="button" @click="restart">
        Restart
      </button>
    </div>

    <section class="tetris-game">
      <header class="tetris-header">
        <div>
          <span class="game-kicker">Arcade classic</span>
          <h1>Tetris</h1>
          <p>Stack falling blocks, clear lines, and keep the board alive.</p>
        </div>
        <ScoreBoard :score="gameState.score" :best-score="bestScore" />
      </header>

      <div class="tetris-layout">
        <div class="tetris-board-wrap">
          <div class="tetris-board" role="grid" aria-label="Tetris board">
            <template v-for="(row, rowIndex) in displayBoard" :key="rowIndex">
              <span
                v-for="(cell, columnIndex) in row"
                :key="`${rowIndex}-${columnIndex}`"
                class="tetris-cell"
                :class="cellClass(cell)"
                role="gridcell"
              ></span>
            </template>
          </div>

          <div
            v-if="gameState.status === 'paused'"
            class="tetris-game-over"
          >
            <span>Game paused</span>
            <h2>Paused</h2>
            <button class="button button--primary" type="button" @click="togglePause">
              Continue
            </button>
          </div>

          <div
            v-else-if="gameState.status === 'gameOver'"
            class="tetris-game-over"
          >
            <span>Final score · {{ gameState.score.toLocaleString() }}</span>
            <h2>Game Over</h2>
            <p>{{ gameState.lines }} lines cleared</p>
            <button class="button button--primary" type="button" @click="restart">
              Play Again
            </button>
          </div>
        </div>

        <aside class="tetris-sidebar">
          <div class="tetris-stat-grid">
            <div>
              <span>Lines</span>
              <strong>{{ gameState.lines }}</strong>
            </div>
            <div>
              <span>Level</span>
              <strong>{{ gameState.level }}</strong>
            </div>
          </div>

          <section class="tetris-next-piece">
            <span>Next Piece</span>
            <div>
              <template v-for="(row, rowIndex) in nextPreview" :key="rowIndex">
                <i
                  v-for="(cell, columnIndex) in row"
                  :key="`${rowIndex}-${columnIndex}`"
                  class="tetris-cell"
                  :class="cellClass(cell)"
                ></i>
              </template>
            </div>
          </section>

          <div class="tetris-controls">
            <span>Keyboard</span>
            <p>← → Move</p>
            <p>↑ Rotate</p>
            <p>↓ Soft drop</p>
            <p>Space Hard drop</p>
            <p>P Pause</p>
          </div>
        </aside>
      </div>

      <div class="tetris-mobile-controls" aria-label="Tetris controls">
        <button type="button" @click="move('left')">←<small>Left</small></button>
        <button type="button" @click="rotate">↻<small>Rotate</small></button>
        <button type="button" @click="move('right')">→<small>Right</small></button>
        <button type="button" @click="dropSoft">↓<small>Down</small></button>
        <button type="button" @click="dropHard">⇊<small>Drop</small></button>
        <button type="button" @click="togglePause">
          {{ gameState.status === 'paused' ? '▶' : 'Ⅱ' }}
          <small>{{ gameState.status === 'paused' ? 'Resume' : 'Pause' }}</small>
        </button>
      </div>
    </section>
  </div>
</template>
