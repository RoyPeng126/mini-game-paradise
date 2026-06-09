<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  DIFFICULTIES,
  addOrReplacePlayerPatch,
  createInitialPatchGridGame,
  getCoveredCellCount,
  getPatchAtCell,
  getSolutionMap,
  getTotalCellCount,
  isCellInPatch,
  normalizeSelection,
  removePlayerPatchAtCell,
  resetPatchGridGame,
} from './logic'

const BEST_TIME_STORAGE_KEY = 'patchgrid-best-times'
const gameState = ref(createInitialPatchGridGame())
const bestTimes = ref({})
const isSelecting = ref(false)
const invalidSelection = ref(null)
let timerInterval = null
let invalidTimeout = null

const puzzle = computed(() => gameState.value.puzzle)
const coveredCount = computed(() =>
  getCoveredCellCount(gameState.value),
)
const totalCount = computed(() => getTotalCellCount(gameState.value))
const progressPercentage = computed(() =>
  Math.round((coveredCount.value / totalCount.value) * 100),
)
const bestTime = computed(() =>
  bestTimes.value[gameState.value.difficulty] ?? 0,
)
const solutionMap = computed(() => getSolutionMap(puzzle.value))
const clueMap = computed(
  () =>
    new Map(
      puzzle.value.clues.map((clue) => [
        `${clue.row}-${clue.col}`,
        clue,
      ]),
    ),
)
const selectionPreview = computed(() => {
  if (!gameState.value.selectedStart || !gameState.value.selectedEnd) {
    return null
  }
  return normalizeSelection(
    gameState.value.selectedStart,
    gameState.value.selectedEnd,
  )
})
const cells = computed(() =>
  Array.from({ length: puzzle.value.rows }, (_, row) =>
    Array.from({ length: puzzle.value.cols }, (_, col) => ({ row, col })),
  ),
)
const boardStyle = computed(() => ({
  '--patchgrid-cols': puzzle.value.cols,
  '--patchgrid-cell-size':
    gameState.value.difficulty === 'easy'
      ? '68px'
      : gameState.value.difficulty === 'normal'
        ? '59px'
        : gameState.value.difficulty === 'hard'
          ? '52px'
          : '46px',
}))
const difficultyOptions = Object.entries(DIFFICULTIES).map(
  ([value, config]) => ({
    value,
    label: value[0].toUpperCase() + value.slice(1),
    detail: `${config.rows} × ${config.cols} · ${config.patchCount} patches`,
  }),
)

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds,
  ).padStart(2, '0')}`
}

function stopTimer() {
  if (!timerInterval) return
  window.clearInterval(timerInterval)
  timerInterval = null
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

function loadBestTimes() {
  if (typeof window === 'undefined') return
  try {
    const saved = localStorage.getItem(BEST_TIME_STORAGE_KEY)
    bestTimes.value = saved ? JSON.parse(saved) : {}
  } catch {
    bestTimes.value = {}
  }
}

function saveBestTime() {
  const difficulty = gameState.value.difficulty
  const elapsedTime = gameState.value.elapsedTime
  const currentBest = bestTimes.value[difficulty]
  if (
    elapsedTime <= 0 ||
    (currentBest !== undefined && elapsedTime >= currentBest)
  ) {
    return
  }

  bestTimes.value = {
    ...bestTimes.value,
    [difficulty]: elapsedTime,
  }
  localStorage.setItem(
    BEST_TIME_STORAGE_KEY,
    JSON.stringify(bestTimes.value),
  )
}

function clearInvalidSelection() {
  if (invalidTimeout) {
    window.clearTimeout(invalidTimeout)
    invalidTimeout = null
  }
  invalidSelection.value = null
}

function clearInteractionState() {
  isSelecting.value = false
  clearInvalidSelection()
}

function newPuzzle(difficulty = gameState.value.difficulty) {
  stopTimer()
  clearInteractionState()
  gameState.value = createInitialPatchGridGame(difficulty)
}

function restartSamePuzzle() {
  stopTimer()
  clearInteractionState()
  gameState.value = resetPatchGridGame(gameState.value)
}

function clearBoard() {
  clearInteractionState()
  gameState.value = {
    ...gameState.value,
    playerPatches: [],
    selectedStart: null,
    selectedEnd: null,
    status: gameState.value.moves > 0 ? 'playing' : 'ready',
    message: 'Board cleared. Select new rectangles around the clues.',
  }
}

function changeDifficulty(event) {
  newPuzzle(event.target.value)
}

function clueAt(row, col) {
  return clueMap.value.get(`${row}-${col}`) ?? null
}

function blankClueSymbol(clue) {
  if (clue.orientation === 'square') return '□'
  if (clue.orientation === 'vertical') return '▯'
  return '▭'
}

function blankClueLabel(clue) {
  if (clue.orientation === 'square') return 'square'
  return `${clue.orientation} rectangle`
}

function playerPatchAt(row, col) {
  return getPatchAtCell(gameState.value, row, col)
}

function playerPatchIndex(patch) {
  return patch
    ? gameState.value.playerPatches.findIndex(
        (candidate) => candidate.id === patch.id,
      )
    : -1
}

function finishSelection(endCell) {
  if (!gameState.value.selectedStart) return

  const patch = normalizeSelection(
    gameState.value.selectedStart,
    endCell,
  )
  const previousMistakes = gameState.value.mistakes
  gameState.value = addOrReplacePlayerPatch(gameState.value, patch)

  if (gameState.value.mistakes > previousMistakes) {
    invalidSelection.value = patch
    invalidTimeout = window.setTimeout(() => {
      invalidSelection.value = null
      invalidTimeout = null
    }, 650)
  }
}

function startSelection(event, row, col) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()

  const existingPatch = playerPatchAt(row, col)
  if (existingPatch) {
    gameState.value = removePlayerPatchAtCell(
      gameState.value,
      row,
      col,
    )
    return
  }

  const cell = { row, col }
  if (gameState.value.selectedStart && !isSelecting.value) {
    finishSelection(cell)
    return
  }

  gameState.value = {
    ...gameState.value,
    selectedStart: cell,
    selectedEnd: cell,
    message: 'Drag or choose the opposite corner of the rectangle.',
  }
  isSelecting.value = true
}

function updateSelection(row, col) {
  if (!isSelecting.value) return
  gameState.value = {
    ...gameState.value,
    selectedEnd: { row, col },
  }
}

function stopSelection() {
  if (!isSelecting.value) return
  isSelecting.value = false

  const { selectedStart, selectedEnd } = gameState.value
  if (
    selectedStart &&
    selectedEnd &&
    (selectedStart.row !== selectedEnd.row ||
      selectedStart.col !== selectedEnd.col)
  ) {
    finishSelection(selectedEnd)
  }
}

function patchBorderClasses(row, col, patch, prefix) {
  if (!patch || !isCellInPatch(row, col, patch)) return {}
  return {
    [`${prefix}-top`]: row === patch.top,
    [`${prefix}-right`]: col === patch.right,
    [`${prefix}-bottom`]: row === patch.bottom,
    [`${prefix}-left`]: col === patch.left,
  }
}

function cellClasses(row, col) {
  const playerPatch = playerPatchAt(row, col)
  const solutionPatch = gameState.value.showSolution
    ? solutionMap.value.get(`${row}-${col}`)
    : null
  const inSelection =
    selectionPreview.value &&
    isCellInPatch(row, col, selectionPreview.value)
  const isInvalid =
    invalidSelection.value &&
    isCellInPatch(row, col, invalidSelection.value)
  const colorIndex = playerPatch
    ? (playerPatchIndex(playerPatch) % 8) + 1
    : null

  return {
    'patchgrid-cell-clue': Boolean(clueAt(row, col)),
    'patchgrid-cell-blank-clue': Boolean(clueAt(row, col)?.isBlank),
    'patchgrid-cell-covered': Boolean(playerPatch),
    'patchgrid-selection-preview': Boolean(inSelection),
    'patchgrid-selection-invalid': Boolean(isInvalid),
    'patchgrid-solution-preview': Boolean(solutionPatch),
    [`patchgrid-color-${colorIndex}`]: Boolean(colorIndex),
    ...patchBorderClasses(
      row,
      col,
      playerPatch,
      'patchgrid-patch-border',
    ),
    ...patchBorderClasses(
      row,
      col,
      solutionPatch,
      'patchgrid-solution-border',
    ),
  }
}

watch(
  () => gameState.value.status,
  (status, previousStatus) => {
    if (status === 'playing' && previousStatus !== 'playing') {
      startTimer()
    }
    if (status === 'won') {
      stopTimer()
      saveBestTime()
    }
  },
)

onMounted(() => {
  loadBestTimes()
  window.addEventListener('pointerup', stopSelection)
  window.addEventListener('pointercancel', stopSelection)
})

onBeforeUnmount(() => {
  stopTimer()
  clearInvalidSelection()
  window.removeEventListener('pointerup', stopSelection)
  window.removeEventListener('pointercancel', stopSelection)
})
</script>

<template>
  <div class="patchgrid-page container">
    <div class="patchgrid-toolbar">
      <RouterLink class="back-link" to="/">
        <span aria-hidden="true">←</span>
        Back to Home
      </RouterLink>

      <div class="patchgrid-toolbar__actions">
        <button type="button" @click="clearBoard">Clear Board</button>
        <button type="button" @click="restartSamePuzzle">
          Restart Same Puzzle
        </button>
        <button
          class="patchgrid-solution-toggle"
          :class="{ 'is-active': gameState.showSolution }"
          type="button"
          :aria-pressed="gameState.showSolution"
          @click="
            gameState = {
              ...gameState,
              showSolution: !gameState.showSolution,
            }
          "
        >
          {{ gameState.showSolution ? 'Hide Solution' : 'Show Solution' }}
        </button>
        <button
          class="button patchgrid-new"
          type="button"
          @click="newPuzzle()"
        >
          New Puzzle
        </button>
      </div>
    </div>

    <section class="patchgrid-panel">
      <header class="patchgrid-header">
        <div>
          <span class="game-kicker">Spatial logic</span>
          <h1>Patch Grid</h1>
          <p>
            Divide the board into rectangular patches that match each clue.
          </p>
        </div>

        <label class="patchgrid-difficulty">
          <span>Difficulty</span>
          <select
            :value="gameState.difficulty"
            aria-label="Patch Grid difficulty"
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

      <div class="patchgrid-stats">
        <div>
          <span>Timer</span>
          <strong>{{ formatTime(gameState.elapsedTime) }}</strong>
        </div>
        <div>
          <span>Moves</span>
          <strong>{{ gameState.moves }}</strong>
        </div>
        <div>
          <span>Mistakes</span>
          <strong>{{ gameState.mistakes }}</strong>
        </div>
        <div>
          <span>Best time</span>
          <strong>{{ bestTime ? formatTime(bestTime) : '--:--' }}</strong>
        </div>
      </div>

      <div class="patchgrid-message" aria-live="polite">
        <div>
          <span>
            {{ gameState.showSolution ? 'Solution Preview' : 'Patch status' }}
          </span>
          <strong>{{ gameState.message }}</strong>
        </div>
        <div>
          <span>{{ coveredCount }} / {{ totalCount }} cells covered</span>
          <div
            class="patchgrid-progress"
            role="progressbar"
            :aria-valuenow="progressPercentage"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span :style="{ width: `${progressPercentage}%` }"></span>
          </div>
        </div>
      </div>

      <div class="patchgrid-board-shell">
        <div
          class="patchgrid-board"
          :style="boardStyle"
          role="grid"
          :aria-label="`${gameState.difficulty} Patch Grid board`"
        >
          <template v-for="row in cells" :key="row[0].row">
            <button
              v-for="cell in row"
              :key="`${cell.row}-${cell.col}`"
              class="patchgrid-cell"
              :class="cellClasses(cell.row, cell.col)"
              type="button"
              role="gridcell"
              :aria-label="`Row ${cell.row + 1}, column ${cell.col + 1}${
                clueAt(cell.row, cell.col)
                  ? `, clue ${
                      clueAt(cell.row, cell.col).displayValue ??
                      blankClueLabel(clueAt(cell.row, cell.col))
                    }`
                  : ''
              }`"
              @pointerdown="startSelection($event, cell.row, cell.col)"
              @pointerenter="updateSelection(cell.row, cell.col)"
            >
              <span
                v-if="clueAt(cell.row, cell.col)"
                class="patchgrid-clue"
              >
                {{
                  clueAt(cell.row, cell.col).displayValue === null
                    ? blankClueSymbol(clueAt(cell.row, cell.col))
                    : clueAt(cell.row, cell.col).displayValue
                }}
              </span>
              <small
                v-if="
                  gameState.showSolution &&
                  clueAt(cell.row, cell.col)
                "
                class="patchgrid-solution-area"
              >
                {{
                  solutionMap.get(`${cell.row}-${cell.col}`)?.area
                }}
              </small>
            </button>
          </template>
        </div>

        <div v-if="gameState.status === 'won'" class="patchgrid-result">
          <span>Board complete</span>
          <h2>Every patch fits.</h2>
          <p>
            Solved in {{ formatTime(gameState.elapsedTime) }} with
            {{ gameState.moves }} moves.
          </p>
          <button
            class="button button--primary"
            type="button"
            @click="newPuzzle()"
          >
            Next puzzle
          </button>
        </div>
      </div>

      <p class="patchgrid-help">
        Drag across a rectangle, or tap its first and opposite corners.
        Tap a completed patch to remove it.
      </p>
    </section>
  </div>
</template>
