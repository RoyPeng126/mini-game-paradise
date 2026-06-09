export const DIFFICULTIES = {
  easy: {
    rows: 5,
    cols: 5,
    numberCount: 4,
    wallCount: 6,
  },
  normal: {
    rows: 6,
    cols: 6,
    numberCount: 6,
    wallCount: 10,
  },
  hard: {
    rows: 7,
    cols: 7,
    numberCount: 8,
    wallCount: 16,
  },
  expert: {
    rows: 8,
    cols: 8,
    numberCount: 10,
    wallCount: 24,
  },
}

export function getCellKey(row, col) {
  return `${row}-${col}`
}

export function parseCellKey(key) {
  const [row, col] = key.split('-').map(Number)
  return { row, col }
}

export function areAdjacent(cellA, cellB) {
  return (
    Math.abs(cellA.row - cellB.row) +
      Math.abs(cellA.col - cellB.col) ===
    1
  )
}

function createRowSerpentinePath(rows, cols) {
  const solution = []

  for (let row = 0; row < rows; row += 1) {
    const columns = Array.from({ length: cols }, (_, col) => col)
    if (row % 2 === 1) columns.reverse()
    columns.forEach((col) => solution.push({ row, col }))
  }

  return solution
}

function createColumnSerpentinePath(rows, cols) {
  const solution = []

  for (let col = 0; col < cols; col += 1) {
    const rowsInColumn = Array.from({ length: rows }, (_, row) => row)
    if (col % 2 === 1) rowsInColumn.reverse()
    rowsInColumn.forEach((row) => solution.push({ row, col }))
  }

  return solution
}

function getBackbiteCandidates(solution, fromStart) {
  const endpoint = fromStart ? solution[0] : solution.at(-1)
  const minimumIndex = fromStart ? 2 : 0
  const maximumIndex = fromStart
    ? solution.length - 1
    : solution.length - 3
  const candidates = []

  for (let index = minimumIndex; index <= maximumIndex; index += 1) {
    if (areAdjacent(endpoint, solution[index])) candidates.push(index)
  }

  return candidates
}

function applyBackbite(solution, fromStart, connectionIndex) {
  if (fromStart) {
    return [
      ...solution.slice(0, connectionIndex).reverse(),
      ...solution.slice(connectionIndex),
    ]
  }

  return [
    ...solution.slice(0, connectionIndex + 1),
    ...solution.slice(connectionIndex + 1).reverse(),
  ]
}

export function generateSerpentinePath(
  rows,
  cols,
  randomFn = Math.random,
) {
  const horizontal = randomFn() < 0.5
  let path = horizontal
    ? createRowSerpentinePath(rows, cols)
    : createColumnSerpentinePath(rows, cols)

  if (randomFn() < 0.5) path = path.reverse()
  return path
}

export function shufflePathSegments(
  path,
  rows,
  cols,
  randomFn = Math.random,
) {
  let shuffled = path.map((cell) => ({ ...cell }))
  const transformationCount = rows * cols * 5

  for (let step = 0; step < transformationCount; step += 1) {
    const fromStart = randomFn() < 0.5
    const candidates = getBackbiteCandidates(shuffled, fromStart)
    if (candidates.length === 0) continue

    const connectionIndex =
      candidates[Math.floor(randomFn() * candidates.length)]
    shuffled = applyBackbite(shuffled, fromStart, connectionIndex)
  }

  return shuffled
}

export function generateHamiltonianPath(
  rows,
  cols,
  randomFn = Math.random,
) {
  const basePath = generateSerpentinePath(rows, cols, randomFn)
  return shufflePathSegments(basePath, rows, cols, randomFn)
}

function shuffleArray(items, randomFn) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

export function pickNumberedCellsFromPath(
  solution,
  numberCount,
  randomFn = Math.random,
) {
  const middleIndexes = Array.from(
    { length: solution.length - 2 },
    (_, index) => index + 1,
  )
  const selectedIndexes = [
    0,
    ...shuffleArray(middleIndexes, randomFn).slice(0, numberCount - 2),
    solution.length - 1,
  ].sort((a, b) => a - b)

  return selectedIndexes.map((solutionIndex, index) => ({
    ...solution[solutionIndex],
    value: index + 1,
  }))
}

export function normalizeWall(cellA, cellB) {
  return [getCellKey(cellA.row, cellA.col), getCellKey(cellB.row, cellB.col)]
    .sort()
    .join('|')
}

export function getAllPossibleWalls(rows, cols) {
  const walls = []

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const from = { row, col }
      if (col + 1 < cols) {
        walls.push({ from, to: { row, col: col + 1 } })
      }
      if (row + 1 < rows) {
        walls.push({ from, to: { row: row + 1, col } })
      }
    }
  }

  return walls
}

export function isWallOnSolutionPath(wall, solution) {
  const wallKey = normalizeWall(wall.from, wall.to)

  return solution.slice(1).some(
    (cell, index) =>
      normalizeWall(solution[index], cell) === wallKey,
  )
}

export function generateWalls(
  rows,
  cols,
  solution,
  wallCount,
  randomFn = Math.random,
) {
  const candidates = getAllPossibleWalls(rows, cols).filter(
    (wall) => !isWallOnSolutionPath(wall, solution),
  )

  return shuffleArray(candidates, randomFn)
    .slice(0, Math.min(wallCount, candidates.length))
    .map((wall) => ({
      from: { ...wall.from },
      to: { ...wall.to },
    }))
}

export function createPuzzleFromSolution(
  difficultyConfig,
  solution,
  randomFn = Math.random,
) {
  const {
    difficulty = 'easy',
    rows,
    cols,
    numberCount,
    wallCount,
  } = difficultyConfig

  return {
    difficulty,
    rows,
    cols,
    numbers: pickNumberedCellsFromPath(
      solution,
      numberCount,
      randomFn,
    ),
    walls: generateWalls(
      rows,
      cols,
      solution,
      wallCount,
      randomFn,
    ),
    solution: solution.map((cell) => ({ ...cell })),
  }
}

export function validateGeneratedPuzzle(puzzle) {
  if (
    !puzzle ||
    !Number.isInteger(puzzle.rows) ||
    !Number.isInteger(puzzle.cols) ||
    puzzle.rows <= 0 ||
    puzzle.cols <= 0
  ) {
    return false
  }

  const { rows, cols, solution, numbers, walls } = puzzle
  if (!Array.isArray(solution) || solution.length !== rows * cols) {
    return false
  }

  const solutionKeys = solution.map(({ row, col }) =>
    getCellKey(row, col),
  )
  if (new Set(solutionKeys).size !== solution.length) return false
  if (
    solution.some(
      ({ row, col }) =>
        row < 0 || row >= rows || col < 0 || col >= cols,
    )
  ) {
    return false
  }
  if (
    solution
      .slice(1)
      .some((cell, index) => !areAdjacent(solution[index], cell))
  ) {
    return false
  }

  if (
    !Array.isArray(numbers) ||
    numbers.length < 2 ||
    !Array.isArray(walls)
  ) {
    return false
  }
  const difficultyConfig = DIFFICULTIES[puzzle.difficulty]
  if (
    difficultyConfig &&
    (numbers.length !== difficultyConfig.numberCount ||
      walls.length !== difficultyConfig.wallCount)
  ) {
    return false
  }

  const numberIndexes = numbers.map((number, index) => {
    if (number.value !== index + 1) return -1
    return solutionKeys.indexOf(getCellKey(number.row, number.col))
  })
  if (numberIndexes.some((index) => index < 0)) return false
  if (numberIndexes[0] !== 0) return false
  if (numberIndexes.at(-1) !== solution.length - 1) return false
  if (
    numberIndexes
      .slice(1)
      .some((solutionIndex, index) => solutionIndex <= numberIndexes[index])
  ) {
    return false
  }

  const wallKeys = walls.map((wall) =>
    normalizeWall(wall.from, wall.to),
  )
  if (new Set(wallKeys).size !== walls.length) return false
  if (
    walls.some(
      (wall) =>
        !areAdjacent(wall.from, wall.to) ||
        [wall.from, wall.to].some(
          ({ row, col }) =>
            row < 0 || row >= rows || col < 0 || col >= cols,
        ) ||
        isWallOnSolutionPath(wall, solution),
    )
  ) {
    return false
  }

  return true
}

export function generatePuzzle(
  difficulty = 'easy',
  randomFn = Math.random,
) {
  const selectedDifficulty = DIFFICULTIES[difficulty]
    ? difficulty
    : 'easy'
  const config = {
    ...DIFFICULTIES[selectedDifficulty],
    difficulty: selectedDifficulty,
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const solution = generateHamiltonianPath(
      config.rows,
      config.cols,
      randomFn,
    )
    const puzzle = createPuzzleFromSolution(
      config,
      solution,
      randomFn,
    )
    if (validateGeneratedPuzzle(puzzle)) return puzzle
  }

  const fallbackSolution = createRowSerpentinePath(
    config.rows,
    config.cols,
  )
  return createPuzzleFromSolution(
    config,
    fallbackSolution,
    () => 0.5,
  )
}

const fallbackRandom = () => 0.5

export const PUZZLES = Object.fromEntries(
  Object.keys(DIFFICULTIES).map((difficulty) => [
    difficulty,
    generatePuzzle(difficulty, fallbackRandom),
  ]),
)

export function getCurrentPuzzle(gameState) {
  return gameState.puzzle ?? PUZZLES[gameState.difficulty]
}

export function isCurrentPathOnSolution(gameState) {
  const solution = getCurrentPuzzle(gameState).solution

  return gameState.path.every(
    (cell, index) =>
      solution[index]?.row === cell.row &&
      solution[index]?.col === cell.col,
  )
}

export function getNextSolutionCell(gameState) {
  if (!isCurrentPathOnSolution(gameState)) return null

  const nextCell = getCurrentPuzzle(gameState).solution[
    gameState.path.length
  ]
  return nextCell ? { ...nextCell } : null
}

export function getSolutionOrderMap(gameState) {
  return new Map(
    getCurrentPuzzle(gameState).solution.map((cell, index) => [
      getCellKey(cell.row, cell.col),
      index + 1,
    ]),
  )
}

export function createInitialPathZipGame(
  difficulty = 'easy',
  randomFn = Math.random,
) {
  const selectedDifficulty = DIFFICULTIES[difficulty]
    ? difficulty
    : 'easy'

  return {
    difficulty: selectedDifficulty,
    puzzle: generatePuzzle(selectedDifficulty, randomFn),
    path: [],
    status: 'ready',
    message: 'Start from number 1',
    elapsedTime: 0,
    moves: 0,
  }
}

export function getNumberAt(gameState, row, col) {
  return (
    getCurrentPuzzle(gameState).numbers.find(
      (number) => number.row === row && number.col === col,
    ) ?? null
  )
}

export function getCellIndexInPath(path, row, col) {
  return path.findIndex((cell) => cell.row === row && cell.col === col)
}

export function hasWallBetween(gameState, cellA, cellB) {
  return getCurrentPuzzle(gameState).walls.some(
    (wall) =>
      (wall.from.row === cellA.row &&
        wall.from.col === cellA.col &&
        wall.to.row === cellB.row &&
        wall.to.col === cellB.col) ||
      (wall.from.row === cellB.row &&
        wall.from.col === cellB.col &&
        wall.to.row === cellA.row &&
        wall.to.col === cellA.col),
  )
}

export function getNextRequiredNumber(gameState) {
  const visitedNumbers = gameState.path
    .map((cell) => getNumberAt(gameState, cell.row, cell.col)?.value)
    .filter(Boolean)

  return visitedNumbers.length + 1
}

export function validateNumberOrder(gameState, nextCell) {
  const number = getNumberAt(gameState, nextCell.row, nextCell.col)
  if (!number) return true
  if (number.value !== getNextRequiredNumber(gameState)) return false

  const puzzle = getCurrentPuzzle(gameState)
  const isFinalNumber = number.value === puzzle.numbers.length
  const isFinalBoardStep =
    gameState.path.length + 1 === puzzle.rows * puzzle.cols

  return !isFinalNumber || isFinalBoardStep
}

export function canAddCellToPath(gameState, row, col) {
  const puzzle = getCurrentPuzzle(gameState)
  if (gameState.status === 'won') return false
  if (row < 0 || row >= puzzle.rows || col < 0 || col >= puzzle.cols) {
    return false
  }
  if (getCellIndexInPath(gameState.path, row, col) !== -1) return false

  const nextCell = { row, col }
  if (gameState.path.length === 0) {
    return getNumberAt(gameState, row, col)?.value === 1
  }

  const previousCell = gameState.path.at(-1)
  return (
    areAdjacent(previousCell, nextCell) &&
    !hasWallBetween(gameState, previousCell, nextCell) &&
    validateNumberOrder(gameState, nextCell)
  )
}

export function checkWin(gameState) {
  const puzzle = getCurrentPuzzle(gameState)
  const finalNumber = puzzle.numbers.at(-1)
  const lastCell = gameState.path.at(-1)

  return (
    gameState.path.length === puzzle.rows * puzzle.cols &&
    getNextRequiredNumber(gameState) === puzzle.numbers.length + 1 &&
    Boolean(finalNumber) &&
    Boolean(lastCell) &&
    lastCell.row === finalNumber.row &&
    lastCell.col === finalNumber.col
  )
}

export function addCellToPath(gameState, row, col) {
  if (!canAddCellToPath(gameState, row, col)) return gameState

  const path = [...gameState.path, { row, col }]
  const nextState = {
    ...gameState,
    path,
    status: 'playing',
    message: `Continue to number ${Math.min(
      getNextRequiredNumber({ ...gameState, path }),
      getCurrentPuzzle(gameState).numbers.length,
    )}`,
    moves: gameState.moves + 1,
  }

  if (checkWin(nextState)) {
    return {
      ...nextState,
      status: 'won',
      message: 'Path complete!',
    }
  }

  const nextNumber = getNextRequiredNumber(nextState)
  if (nextNumber > getCurrentPuzzle(nextState).numbers.length) {
    return {
      ...nextState,
      message: 'Fill every remaining cell',
    }
  }

  return nextState
}

export function removeBackToCell(gameState, row, col) {
  const cellIndex = getCellIndexInPath(gameState.path, row, col)
  if (cellIndex === -1 || gameState.status === 'won') return gameState

  const path = gameState.path.slice(0, cellIndex + 1)
  const nextNumber = getNextRequiredNumber({ ...gameState, path })

  return {
    ...gameState,
    path,
    status: path.length > 0 ? 'playing' : 'ready',
    message:
      nextNumber > getCurrentPuzzle(gameState).numbers.length
        ? 'Fill every remaining cell'
        : `Continue to number ${nextNumber}`,
    moves: gameState.moves + 1,
  }
}

export function resetPath(gameState, resetStats = true) {
  return {
    ...gameState,
    path: [],
    status: 'ready',
    message: 'Start from number 1',
    elapsedTime: resetStats ? 0 : gameState.elapsedTime,
    moves: resetStats ? 0 : gameState.moves,
  }
}

export function getPathProgress(gameState) {
  const puzzle = getCurrentPuzzle(gameState)
  return {
    completed: gameState.path.length,
    total: puzzle.rows * puzzle.cols,
    percentage: Math.round(
      (gameState.path.length / (puzzle.rows * puzzle.cols)) * 100,
    ),
  }
}
