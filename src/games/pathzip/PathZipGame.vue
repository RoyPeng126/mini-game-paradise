<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  DIFFICULTIES,
  addCellToPath,
  areAdjacent,
  canAddCellToPath,
  createInitialPathZipGame,
  getCellIndexInPath,
  getCurrentPuzzle,
  getNextRequiredNumber,
  getNumberAt,
  getPathProgress,
  getNextSolutionCell,
  getSolutionOrderMap,
  hasWallBetween,
  isCurrentPathOnSolution,
  removeBackToCell,
  resetPath,
} from './logic'

const BEST_TIME_STORAGE_KEY = 'pathzip-best-times'

const gameState = ref(createInitialPathZipGame())
const bestTimes = ref({})
const isDrawing = ref(false)
const lastDrawnCellKey = ref(null)
const hintCellKey = ref(null)
const showSolution = ref(false)
let timerInterval = null
let hintTimeout = null

const puzzle = computed(() => getCurrentPuzzle(gameState.value))
const progress = computed(() => getPathProgress(gameState.value))
const pathHead = computed(() => gameState.value.path.at(-1) ?? null)
const solutionOrderMap = computed(() =>
  getSolutionOrderMap(gameState.value),
)
const bestTime = computed(
  () => bestTimes.value[gameState.value.difficulty] ?? null,
)
const difficultyOptions = Object.entries(DIFFICULTIES).map(
  ([value, config]) => ({
    value,
    label: value[0].toUpperCase() + value.slice(1),
    detail: `${config.rows} × ${config.cols}`,
  }),
)

const cells = computed(() =>
  Array.from({ length: puzzle.value.rows }, (_, row) =>
    Array.from({ length: puzzle.value.cols }, (_, col) => ({ row, col })),
  ),
)

const boardStyle = computed(() => ({
  '--pathzip-cols': puzzle.value.cols,
  '--pathzip-cell-size':
    gameState.value.difficulty === 'easy'
      ? '76px'
      : gameState.value.difficulty === 'normal'
        ? '64px'
        : gameState.value.difficulty === 'hard'
          ? '56px'
          : '50px',
}))

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`
}

function loadBestTimes() {
  if (typeof window === 'undefined') return

  try {
    const savedTimes = localStorage.getItem(BEST_TIME_STORAGE_KEY)
    bestTimes.value = savedTimes ? JSON.parse(savedTimes) : {}
  } catch {
    bestTimes.value = {}
  }
}

function saveBestTime() {
  const difficulty = gameState.value.difficulty
  const currentBest = bestTimes.value[difficulty]
  const elapsedTime = gameState.value.elapsedTime

  if (currentBest !== undefined && elapsedTime >= currentBest) return

  bestTimes.value = {
    ...bestTimes.value,
    [difficulty]: elapsedTime,
  }
  localStorage.setItem(
    BEST_TIME_STORAGE_KEY,
    JSON.stringify(bestTimes.value),
  )
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

function clearHint() {
  if (hintTimeout) {
    window.clearTimeout(hintTimeout)
    hintTimeout = null
  }
  hintCellKey.value = null
}

function newPuzzle(difficulty = gameState.value.difficulty) {
  stopTimer()
  clearHint()
  isDrawing.value = false
  lastDrawnCellKey.value = null
  showSolution.value = false
  gameState.value = createInitialPathZipGame(difficulty)
}

function restartSamePuzzle() {
  stopTimer()
  clearHint()
  isDrawing.value = false
  lastDrawnCellKey.value = null
  gameState.value = resetPath(gameState.value)
}

function clearPath() {
  clearHint()
  isDrawing.value = false
  lastDrawnCellKey.value = null
  gameState.value = resetPath(gameState.value, false)
}

function showHint() {
  clearHint()

  if (!isCurrentPathOnSolution(gameState.value)) {
    gameState.value = {
      ...gameState.value,
      message:
        'Current path does not match the generated solution. Please backtrack.',
    }
    return
  }

  const nextCell = getNextSolutionCell(gameState.value)
  if (!nextCell) {
    gameState.value = {
      ...gameState.value,
      message: 'The generated solution is already complete.',
    }
    return
  }

  hintCellKey.value = `${nextCell.row}-${nextCell.col}`
  gameState.value = {
    ...gameState.value,
    message: 'Hint: the next generated solution cell is highlighted.',
  }
  hintTimeout = window.setTimeout(() => {
    hintCellKey.value = null
    hintTimeout = null
  }, 1500)
}

function toggleSolution() {
  showSolution.value = !showSolution.value
  clearHint()
}

function changeDifficulty(event) {
  newPuzzle(event.target.value)
}

function invalidMoveMessage(row, col) {
  if (gameState.value.path.length === 0) return 'Start from number 1'

  const cellIndex = getCellIndexInPath(gameState.value.path, row, col)
  if (cellIndex !== -1) return ''

  const nextCell = { row, col }
  const previousCell = gameState.value.path.at(-1)
  if (!areAdjacent(previousCell, nextCell)) {
    return 'Move only to an adjacent cell'
  }
  if (hasWallBetween(gameState.value, previousCell, nextCell)) {
    return 'A wall blocks that direction'
  }

  const number = getNumberAt(gameState.value, row, col)
  if (number && number.value !== getNextRequiredNumber(gameState.value)) {
    return `Visit number ${getNextRequiredNumber(gameState.value)} next`
  }
  if (
    number?.value === puzzle.value.numbers.length &&
    gameState.value.path.length + 1 < puzzle.value.rows * puzzle.value.cols
  ) {
    return 'The final number must be the last step'
  }

  return 'That move cannot be used'
}

function visitCell(row, col) {
  if (gameState.value.status === 'won') return

  const pathIndex = getCellIndexInPath(gameState.value.path, row, col)
  if (pathIndex !== -1) {
    gameState.value = removeBackToCell(gameState.value, row, col)
    return
  }

  if (!canAddCellToPath(gameState.value, row, col)) {
    gameState.value = {
      ...gameState.value,
      message: invalidMoveMessage(row, col),
    }
    return
  }

  gameState.value = addCellToPath(gameState.value, row, col)
}

function startDrawing(event, row, col) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  isDrawing.value = true
  lastDrawnCellKey.value = `${row}-${col}`
  visitCell(row, col)
}

function continueDrawing(row, col) {
  if (!isDrawing.value) return
  const cellKey = `${row}-${col}`
  if (lastDrawnCellKey.value === cellKey) return
  lastDrawnCellKey.value = cellKey
  visitCell(row, col)
}

function handleBoardPointerMove(event) {
  if (!isDrawing.value || event.pointerType === 'mouse') return

  const element = document.elementFromPoint(event.clientX, event.clientY)
  const cell = element?.closest('[data-pathzip-cell]')
  if (!cell) return

  continueDrawing(Number(cell.dataset.row), Number(cell.dataset.col))
}

function stopDrawing() {
  isDrawing.value = false
  lastDrawnCellKey.value = null
}

function handleKeyboardClick(event, row, col) {
  if (event.detail === 0) visitCell(row, col)
}

function wallClasses(row, col) {
  const cell = { row, col }
  const classes = {}
  const directions = {
    top: { row: row - 1, col },
    right: { row, col: col + 1 },
    bottom: { row: row + 1, col },
    left: { row, col: col - 1 },
  }

  Object.entries(directions).forEach(([direction, neighbor]) => {
    if (hasWallBetween(gameState.value, cell, neighbor)) {
      classes[`pathzip-cell--wall-${direction}`] = true
    }
  })

  return classes
}

function pathIndex(row, col) {
  return getCellIndexInPath(gameState.value.path, row, col)
}

function isPathHead(row, col) {
  return pathHead.value?.row === row && pathHead.value?.col === col
}

function solutionOrder(row, col) {
  return solutionOrderMap.value.get(`${row}-${col}`) ?? null
}

watch(
  () => gameState.value.status,
  (status, previousStatus) => {
    if (status === 'playing' && previousStatus !== 'playing') startTimer()

    if (status === 'won') {
      stopTimer()
      saveBestTime()
    }
  },
)

onMounted(() => {
  loadBestTimes()
  window.addEventListener('pointerup', stopDrawing)
  window.addEventListener('pointercancel', stopDrawing)
})

onBeforeUnmount(() => {
  stopTimer()
  clearHint()
  window.removeEventListener('pointerup', stopDrawing)
  window.removeEventListener('pointercancel', stopDrawing)
})
</script>

<template>
  <div class="pathzip-page container">
    <div class="pathzip-nav">
      <RouterLink class="back-link" to="/">
        <span aria-hidden="true">←</span>
        Back to Home
      </RouterLink>
      <div class="pathzip-nav__actions">
        <button class="pathzip-reset" type="button" @click="showHint">
          Hint
        </button>
        <button
          class="pathzip-solution-toggle"
          :class="{ 'pathzip-solution-toggle--active': showSolution }"
          type="button"
          :aria-pressed="showSolution"
          @click="toggleSolution"
        >
          {{ showSolution ? 'Hide Solution' : 'Show Solution' }}
        </button>
        <button class="pathzip-reset" type="button" @click="clearPath">
          Reset Path
        </button>
        <button
          class="pathzip-reset"
          type="button"
          @click="restartSamePuzzle"
        >
          Restart Same Puzzle
        </button>
        <button
          class="button pathzip-restart"
          type="button"
          @click="newPuzzle()"
        >
          <span aria-hidden="true">↻</span>
          New Puzzle
        </button>
      </div>
    </div>

    <section class="pathzip">
      <header class="pathzip__header">
        <div>
          <span class="game-kicker">Path logic</span>
          <h1>Path Zip</h1>
          <p>Fill every cell with one path while visiting numbers in order.</p>
          <p class="pathzip-random-note">Puzzle is randomly generated.</p>
        </div>

        <label class="pathzip-difficulty">
          <span>Difficulty</span>
          <select
            :value="gameState.difficulty"
            aria-label="Path Zip difficulty"
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

      <div class="pathzip-stats" aria-label="Path Zip game status">
        <div>
          <span>Timer</span>
          <strong>{{ formatTime(gameState.elapsedTime) }}</strong>
        </div>
        <div>
          <span>Moves</span>
          <strong>{{ gameState.moves }}</strong>
        </div>
        <div>
          <span>Progress</span>
          <strong>{{ progress.completed }} / {{ progress.total }}</strong>
        </div>
        <div>
          <span>Best time</span>
          <strong>{{ bestTime === null ? '--:--' : formatTime(bestTime) }}</strong>
        </div>
      </div>

      <div class="pathzip-message" aria-live="polite">
        <div>
          <span>
            Random puzzle ·
            {{ showSolution ? 'Solution Preview · ' : '' }}
            {{ gameState.status === 'won' ? 'Complete' : 'Next move' }}
          </span>
          <strong>{{ gameState.message }}</strong>
        </div>
        <div
          class="pathzip-progress"
          role="progressbar"
          :aria-valuenow="progress.percentage"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span :style="{ width: `${progress.percentage}%` }"></span>
        </div>
      </div>

      <div class="pathzip-board-shell">
        <div
          class="pathzip-board"
          :class="{
            'pathzip-board--complete': gameState.status === 'won',
          }"
          :style="boardStyle"
          role="grid"
          :aria-label="`${gameState.difficulty} Path Zip board`"
          @pointermove.prevent="handleBoardPointerMove"
        >
          <template v-for="row in cells" :key="row[0].row">
            <button
              v-for="cell in row"
              :key="`${cell.row}-${cell.col}`"
              class="pathzip-cell"
              :class="[
                wallClasses(cell.row, cell.col),
                {
                  'pathzip-cell--path':
                    pathIndex(cell.row, cell.col) !== -1,
                  'pathzip-cell--head': isPathHead(cell.row, cell.col),
                  'pathzip-cell-hint':
                    hintCellKey === `${cell.row}-${cell.col}`,
                  'pathzip-cell-solution': showSolution,
                  'pathzip-cell--number': getNumberAt(
                    gameState,
                    cell.row,
                    cell.col,
                  ),
                },
              ]"
              type="button"
              role="gridcell"
              :data-row="cell.row"
              :data-col="cell.col"
              data-pathzip-cell
              :aria-label="`Row ${cell.row + 1}, column ${cell.col + 1}${
                getNumberAt(gameState, cell.row, cell.col)
                  ? `, number ${getNumberAt(gameState, cell.row, cell.col).value}`
                  : ''
              }`"
              @pointerdown="startDrawing($event, cell.row, cell.col)"
              @pointerenter="continueDrawing(cell.row, cell.col)"
              @click="handleKeyboardClick($event, cell.row, cell.col)"
            >
              <span
                v-if="getNumberAt(gameState, cell.row, cell.col)"
                class="pathzip-cell__number"
              >
                {{ getNumberAt(gameState, cell.row, cell.col).value }}
              </span>
              <small
                v-if="
                  pathIndex(cell.row, cell.col) !== -1 &&
                  !showSolution
                "
                class="pathzip-cell__order"
              >
                {{ pathIndex(cell.row, cell.col) + 1 }}
              </small>
              <small
                v-if="showSolution"
                class="pathzip-solution-order"
              >
                {{ solutionOrder(cell.row, cell.col) }}
              </small>
            </button>
          </template>
        </div>

        <div
          v-if="gameState.status === 'won'"
          class="pathzip-result"
          aria-live="polite"
        >
          <span>Every cell connected</span>
          <h2>Path complete!</h2>
          <p>
            Solved in {{ formatTime(gameState.elapsedTime) }} with
            {{ gameState.moves }} moves.
          </p>
          <button
            class="button button--primary"
            type="button"
            @click="newPuzzle()"
          >
            New puzzle
          </button>
        </div>
      </div>

      <p class="pathzip-help">
        Click or drag from number 1. Revisit a path cell to rewind to it.
      </p>
    </section>
  </div>
</template>
