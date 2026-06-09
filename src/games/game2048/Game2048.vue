<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useScoreStore } from '../../stores/scoreStore'
import ScoreBoard from '../../components/ScoreBoard.vue'
import {
  addRandomTile,
  createEmptyBoard,
  isGameOver,
  moveDown,
  moveLeft,
  moveRight,
  moveUp,
} from './logic'

const scoreStore = useScoreStore()
const board = ref(createEmptyBoard())
const score = ref(0)
const gameOver = ref(false)
const hasWon = ref(false)
const showWinMessage = ref(true)

const bestScore = computed(() => scoreStore.getBestScore('2048'))

const moves = {
  left: moveLeft,
  right: moveRight,
  up: moveUp,
  down: moveDown,
}

const keyDirections = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

function startGame() {
  let initialBoard = addRandomTile(createEmptyBoard())
  initialBoard = addRandomTile(initialBoard)
  board.value = initialBoard
  score.value = 0
  gameOver.value = false
  hasWon.value = false
  showWinMessage.value = true
}

function makeMove(direction) {
  if (gameOver.value) return

  const move = moves[direction]
  if (!move) return

  const result = move(board.value)
  if (!result.moved) return

  board.value = addRandomTile(result.board)
  score.value += result.score
  scoreStore.updateBestScore('2048', score.value)

  if (!hasWon.value && board.value.some((row) => row.includes(2048))) {
    hasWon.value = true
  }

  gameOver.value = isGameOver(board.value)
}

function handleKeydown(event) {
  const direction = keyDirections[event.key]
  if (!direction) return

  event.preventDefault()
  makeMove(direction)
}

function tileClass(value) {
  return value ? `tile-${value}` : 'tile-empty'
}

onMounted(() => {
  scoreStore.loadScores()
  startGame()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <section class="game-2048">
    <div class="game-2048__header">
      <div>
        <span class="game-kicker">Classic puzzle</span>
        <h1>2048</h1>
        <p>Join matching tiles and work your way up to 2048.</p>
      </div>
      <ScoreBoard :score="score" :best-score="bestScore" />
    </div>

    <div class="game-2048__actions">
      <p><strong>How to play:</strong> Use arrow keys or the controls below.</p>
      <button class="button button--restart" type="button" @click="startGame">
        <span aria-hidden="true">↻</span>
        Restart
      </button>
    </div>

    <div class="board-wrap">
      <div class="game-board" role="grid" aria-label="2048 game board">
        <template v-for="(row, rowIndex) in board" :key="rowIndex">
          <div
            v-for="(tile, columnIndex) in row"
            :key="`${rowIndex}-${columnIndex}`"
            class="tile"
            :class="tileClass(tile)"
            role="gridcell"
            :aria-label="tile ? String(tile) : 'Empty'"
          >
            {{ tile || '' }}
          </div>
        </template>
      </div>

      <div v-if="gameOver" class="game-overlay">
        <span>Final score · {{ score.toLocaleString() }}</span>
        <h2>Game Over</h2>
        <p>No more moves. Ready for another run?</p>
        <button class="button button--primary" type="button" @click="startGame">
          Play again
        </button>
      </div>

      <div v-else-if="hasWon && showWinMessage" class="game-overlay">
        <span>Milestone reached</span>
        <h2>You made 2048!</h2>
        <p>Keep playing and see how high you can go.</p>
        <button
          class="button button--primary"
          type="button"
          @click="showWinMessage = false"
        >
          Keep going
        </button>
      </div>
    </div>

    <div class="mobile-controls" aria-label="Game direction controls">
      <button type="button" aria-label="Move up" @click="makeMove('up')">↑</button>
      <button type="button" aria-label="Move left" @click="makeMove('left')">←</button>
      <button type="button" aria-label="Move down" @click="makeMove('down')">↓</button>
      <button type="button" aria-label="Move right" @click="makeMove('right')">→</button>
    </div>
  </section>
</template>
