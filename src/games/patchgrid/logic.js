export const DIFFICULTIES = {
  easy: {
    rows: 5,
    cols: 5,
    patchCount: 7,
    blankClueRatio: 0,
  },
  normal: {
    rows: 6,
    cols: 6,
    patchCount: 9,
    blankClueRatio: 0.2,
  },
  hard: {
    rows: 7,
    cols: 7,
    patchCount: 12,
    blankClueRatio: 0.3,
  },
  expert: {
    rows: 8,
    cols: 8,
    patchCount: 15,
    blankClueRatio: 0.4,
  },
}

export function getCellKey(row, col) {
  return `${row}-${col}`
}

export function normalizePatch(rect) {
  const top = Math.min(rect.top, rect.bottom)
  const left = Math.min(rect.left, rect.right)
  const bottom = Math.max(rect.top, rect.bottom)
  const right = Math.max(rect.left, rect.right)

  return {
    ...rect,
    top,
    left,
    bottom,
    right,
    area: (bottom - top + 1) * (right - left + 1),
  }
}

export function getPatchArea(patch) {
  return (
    (Math.abs(patch.bottom - patch.top) + 1) *
    (Math.abs(patch.right - patch.left) + 1)
  )
}

export function getPatchShape(patch) {
  const normalized = normalizePatch(patch)
  const height = normalized.bottom - normalized.top + 1
  const width = normalized.right - normalized.left + 1

  if (height === width) {
    return { shape: 'square', orientation: 'square' }
  }

  return {
    shape: 'rectangle',
    orientation: height > width ? 'vertical' : 'horizontal',
  }
}

export function normalizeSelection(startCell, endCell) {
  return normalizePatch({
    top: startCell.row,
    left: startCell.col,
    bottom: endCell.row,
    right: endCell.col,
  })
}

export function isCellInPatch(row, col, patch) {
  const normalized = normalizePatch(patch)
  return (
    row >= normalized.top &&
    row <= normalized.bottom &&
    col >= normalized.left &&
    col <= normalized.right
  )
}

export function doPatchesOverlap(a, b) {
  const first = normalizePatch(a)
  const second = normalizePatch(b)

  return !(
    first.bottom < second.top ||
    first.top > second.bottom ||
    first.right < second.left ||
    first.left > second.right
  )
}

function getValidRectangleSplits(rect) {
  const normalized = normalizePatch(rect)
  const splits = []

  for (
    let splitRow = normalized.top;
    splitRow < normalized.bottom;
    splitRow += 1
  ) {
    const first = normalizePatch({
      top: normalized.top,
      left: normalized.left,
      bottom: splitRow,
      right: normalized.right,
    })
    const second = normalizePatch({
      top: splitRow + 1,
      left: normalized.left,
      bottom: normalized.bottom,
      right: normalized.right,
    })
    if (first.area >= 2 && second.area >= 2) {
      splits.push([first, second])
    }
  }

  for (
    let splitCol = normalized.left;
    splitCol < normalized.right;
    splitCol += 1
  ) {
    const first = normalizePatch({
      top: normalized.top,
      left: normalized.left,
      bottom: normalized.bottom,
      right: splitCol,
    })
    const second = normalizePatch({
      top: normalized.top,
      left: splitCol + 1,
      bottom: normalized.bottom,
      right: normalized.right,
    })
    if (first.area >= 2 && second.area >= 2) {
      splits.push([first, second])
    }
  }

  return splits
}

export function splitRectangle(rect, randomFn = Math.random) {
  const validSplits = getValidRectangleSplits(rect)
  if (validSplits.length === 0) return null

  return validSplits[Math.floor(randomFn() * validSplits.length)]
}

export function splitRectanglesUntilCount(
  initialRect,
  targetCount,
  randomFn = Math.random,
) {
  const rectangles = [normalizePatch(initialRect)]

  while (rectangles.length < targetCount) {
    const candidates = rectangles
      .map((rect, index) => ({ rect, index }))
      .filter(({ rect }) => getValidRectangleSplits(rect).length > 0)
      .sort((a, b) => getPatchArea(b.rect) - getPatchArea(a.rect))

    if (candidates.length === 0) break

    const candidatePool = candidates.slice(
      0,
      Math.max(1, Math.ceil(candidates.length / 2)),
    )
    const selected =
      candidatePool[Math.floor(randomFn() * candidatePool.length)]
    const split = splitRectangle(selected.rect, randomFn)
    if (!split) break

    rectangles.splice(selected.index, 1, ...split)
  }

  return rectangles
}

export function generateSolutionPatches(
  rows,
  cols,
  patchCount,
  randomFn = Math.random,
) {
  const initialRect = {
    top: 0,
    left: 0,
    bottom: rows - 1,
    right: cols - 1,
  }
  const rectangles = splitRectanglesUntilCount(
    initialRect,
    patchCount,
    randomFn,
  )

  return rectangles.map((rect, index) => ({
    ...normalizePatch(rect),
    id: `patch-${index + 1}`,
  }))
}

export function chooseClueForPatch(patch, randomFn = Math.random) {
  const row =
    patch.top +
    Math.floor(randomFn() * (patch.bottom - patch.top + 1))
  const col =
    patch.left +
    Math.floor(randomFn() * (patch.right - patch.left + 1))
  return { row, col }
}

function shuffle(items, randomFn) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1))
    ;[result[index], result[swapIndex]] = [
      result[swapIndex],
      result[index],
    ]
  }
  return result
}

export function createCluesFromPatches(
  patches,
  blankClueRatio,
  randomFn = Math.random,
) {
  const blankCount = Math.round(patches.length * blankClueRatio)
  const blankIndexes = new Set(
    shuffle(
      patches.map((_, index) => index),
      randomFn,
    ).slice(0, blankCount),
  )

  return patches.map((patch, index) => {
    const clueCell = chooseClueForPatch(patch, randomFn)
    const isBlank = blankIndexes.has(index)
    const { shape, orientation } = getPatchShape(patch)
    return {
      id: `clue-${index + 1}`,
      row: clueCell.row,
      col: clueCell.col,
      area: getPatchArea(patch),
      displayValue: isBlank ? null : getPatchArea(patch),
      isBlank,
      shape,
      orientation,
    }
  })
}

export function getClueInsidePatch(puzzle, patch) {
  const clues = puzzle.clues.filter((clue) =>
    isCellInPatch(clue.row, clue.col, patch),
  )
  return clues.length === 1 ? clues[0] : null
}

export function containsExactlyOneClue(puzzle, patch) {
  return Boolean(getClueInsidePatch(puzzle, patch))
}

export function getSolutionPatchForClue(puzzle, clueId) {
  return (
    puzzle.solutionPatches.find(
      (patch) => patch.clueId === clueId,
    ) ?? null
  )
}

export function getSolutionMap(puzzle) {
  const solutionMap = new Map()

  puzzle.solutionPatches.forEach((patch) => {
    for (let row = patch.top; row <= patch.bottom; row += 1) {
      for (let col = patch.left; col <= patch.right; col += 1) {
        solutionMap.set(getCellKey(row, col), patch)
      }
    }
  })

  return solutionMap
}

export function validateGeneratedPatchPuzzle(puzzle) {
  if (
    !puzzle ||
    !Number.isInteger(puzzle.rows) ||
    !Number.isInteger(puzzle.cols) ||
    !Array.isArray(puzzle.clues) ||
    !Array.isArray(puzzle.solutionPatches) ||
    puzzle.clues.length !== puzzle.solutionPatches.length
  ) {
    return false
  }

  const covered = new Set()

  for (const patch of puzzle.solutionPatches) {
    const normalized = normalizePatch(patch)
    if (
      patch.top !== normalized.top ||
      patch.left !== normalized.left ||
      patch.bottom !== normalized.bottom ||
      patch.right !== normalized.right ||
      patch.area !== getPatchArea(patch) ||
      patch.top < 0 ||
      patch.left < 0 ||
      patch.bottom >= puzzle.rows ||
      patch.right >= puzzle.cols
    ) {
      return false
    }
    if (patch.area < 2) return false

    const clue = puzzle.clues.find(
      (candidate) => candidate.id === patch.clueId,
    )
    if (!clue || !isCellInPatch(clue.row, clue.col, patch)) {
      return false
    }
    if (clue.area !== patch.area) return false
    const patchShape = getPatchShape(patch)
    if (
      clue.shape !== patchShape.shape ||
      clue.orientation !== patchShape.orientation
    ) {
      return false
    }
    if (clue.isBlank && clue.displayValue !== null) return false
    if (!clue.isBlank && clue.displayValue !== patch.area) return false
    if (!containsExactlyOneClue(puzzle, patch)) return false

    for (let row = patch.top; row <= patch.bottom; row += 1) {
      for (let col = patch.left; col <= patch.right; col += 1) {
        const key = getCellKey(row, col)
        if (covered.has(key)) return false
        covered.add(key)
      }
    }
  }

  return covered.size === puzzle.rows * puzzle.cols
}

export function generatePatchPuzzle(
  difficulty = 'easy',
  randomFn = Math.random,
) {
  const selectedDifficulty = DIFFICULTIES[difficulty]
    ? difficulty
    : 'easy'
  const config = DIFFICULTIES[selectedDifficulty]
  const solutionPatches = generateSolutionPatches(
    config.rows,
    config.cols,
    config.patchCount,
    randomFn,
  )
  const clues = createCluesFromPatches(
    solutionPatches,
    config.blankClueRatio,
    randomFn,
  )
  const linkedPatches = solutionPatches.map((patch, index) => ({
    ...patch,
    clueId: clues[index].id,
  }))
  const puzzle = {
    difficulty: selectedDifficulty,
    rows: config.rows,
    cols: config.cols,
    clues,
    solutionPatches: linkedPatches,
  }

  if (validateGeneratedPatchPuzzle(puzzle)) return puzzle

  const fallbackRandom = () => 0.5
  return generatePatchPuzzle(selectedDifficulty, fallbackRandom)
}

export function createInitialPatchGridGame(
  difficulty = 'easy',
  randomFn = Math.random,
) {
  const selectedDifficulty = DIFFICULTIES[difficulty]
    ? difficulty
    : 'easy'

  return {
    difficulty: selectedDifficulty,
    puzzle: generatePatchPuzzle(selectedDifficulty, randomFn),
    playerPatches: [],
    selectedStart: null,
    selectedEnd: null,
    status: 'ready',
    message: 'Select a rectangle around each clue.',
    elapsedTime: 0,
    moves: 0,
    mistakes: 0,
    showSolution: false,
  }
}

export function resetPatchGridGame(gameState) {
  return {
    ...gameState,
    playerPatches: [],
    selectedStart: null,
    selectedEnd: null,
    status: 'ready',
    message: 'Select a rectangle around each clue.',
    elapsedTime: 0,
    moves: 0,
    mistakes: 0,
    showSolution: false,
  }
}

export function getPatchAtCell(gameState, row, col) {
  return (
    gameState.playerPatches.find((patch) =>
      isCellInPatch(row, col, patch),
    ) ?? null
  )
}

function isPatchInsideBoard(gameState, patch) {
  return (
    patch.top >= 0 &&
    patch.left >= 0 &&
    patch.bottom < gameState.puzzle.rows &&
    patch.right < gameState.puzzle.cols
  )
}

export function isValidPlayerPatch(gameState, patch) {
  const normalized = normalizePatch(patch)
  if (!isPatchInsideBoard(gameState, normalized)) return false

  const clue = getClueInsidePatch(gameState.puzzle, normalized)
  if (!clue) return false
  if (
    clue.displayValue !== null &&
    normalized.area !== clue.displayValue
  ) {
    return false
  }
  if (clue.isBlank) {
    const shape = getPatchShape(normalized)
    if (
      shape.shape !== clue.shape ||
      shape.orientation !== clue.orientation
    ) {
      return false
    }
  }

  return !gameState.playerPatches
    .filter((existing) => existing.clueId !== clue.id)
    .some((existing) => doPatchesOverlap(existing, normalized))
}

export function isPlayerPatchMatchingSolution(
  gameState,
  playerPatch,
) {
  const solution = getSolutionPatchForClue(
    gameState.puzzle,
    playerPatch.clueId,
  )
  if (!solution) return false

  const player = normalizePatch(playerPatch)
  return (
    player.top === solution.top &&
    player.left === solution.left &&
    player.bottom === solution.bottom &&
    player.right === solution.right
  )
}

function getInvalidPatchMessage(gameState, patch) {
  const normalized = normalizePatch(patch)
  if (!isPatchInsideBoard(gameState, normalized)) {
    return 'Keep the rectangle inside the board.'
  }

  const clues = gameState.puzzle.clues.filter((clue) =>
    isCellInPatch(clue.row, clue.col, normalized),
  )
  if (clues.length === 0) return 'Each patch needs one clue.'
  if (clues.length > 1) return 'A patch can contain only one clue.'
  if (
    clues[0].displayValue !== null &&
    normalized.area !== clues[0].displayValue
  ) {
    return `This clue needs exactly ${clues[0].displayValue} cells.`
  }
  if (clues[0].isBlank) {
    const shape = getPatchShape(normalized)
    if (
      shape.shape !== clues[0].shape ||
      shape.orientation !== clues[0].orientation
    ) {
      const labels = {
        square: 'a square',
        vertical: 'a vertical rectangle',
        horizontal: 'a horizontal rectangle',
      }
      return `This clue needs ${labels[clues[0].orientation]}.`
    }
  }

  return 'Patches cannot overlap.'
}

export function addOrReplacePlayerPatch(gameState, patch) {
  const normalized = normalizePatch(patch)
  if (!isValidPlayerPatch(gameState, normalized)) {
    return {
      ...gameState,
      selectedStart: null,
      selectedEnd: null,
      mistakes: gameState.mistakes + 1,
      message: getInvalidPatchMessage(gameState, normalized),
    }
  }

  const clue = getClueInsidePatch(gameState.puzzle, normalized)
  const playerPatch = {
    ...normalized,
    id: `player-patch-${gameState.moves + 1}`,
    clueId: clue.id,
  }
  const playerPatches = [
    ...gameState.playerPatches.filter(
      (existing) => existing.clueId !== clue.id,
    ),
    playerPatch,
  ]
  const nextState = {
    ...gameState,
    playerPatches,
    selectedStart: null,
    selectedEnd: null,
    status: 'playing',
    message: 'Patch added. Continue covering the board.',
    moves: gameState.moves + 1,
  }

  if (checkWin(nextState)) {
    return {
      ...nextState,
      status: 'won',
      message: 'Every patch matches the solution!',
    }
  }

  return nextState
}

export function removePlayerPatchAtCell(gameState, row, col) {
  const patch = getPatchAtCell(gameState, row, col)
  if (!patch || gameState.status === 'won') return gameState

  const playerPatches = gameState.playerPatches.filter(
    (candidate) => candidate.id !== patch.id,
  )
  return {
    ...gameState,
    playerPatches,
    status: playerPatches.length > 0 ? 'playing' : 'ready',
    message: 'Patch removed. Select a replacement rectangle.',
    moves: gameState.moves + 1,
  }
}

export function getCoveredCellCount(gameState) {
  const covered = new Set()
  gameState.playerPatches.forEach((patch) => {
    for (let row = patch.top; row <= patch.bottom; row += 1) {
      for (let col = patch.left; col <= patch.right; col += 1) {
        covered.add(getCellKey(row, col))
      }
    }
  })
  return covered.size
}

export function getTotalCellCount(gameState) {
  return gameState.puzzle.rows * gameState.puzzle.cols
}

export function checkWin(gameState) {
  if (
    gameState.playerPatches.length !== gameState.puzzle.clues.length ||
    getCoveredCellCount(gameState) !== getTotalCellCount(gameState)
  ) {
    return false
  }

  return gameState.playerPatches.every(
    (patch, index) =>
      isValidPlayerPatch(
        {
          ...gameState,
          playerPatches: gameState.playerPatches.filter(
            (_, candidateIndex) => candidateIndex !== index,
          ),
        },
        patch,
      ),
  )
}
