import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DIFFICULTIES,
  addCellToPath,
  areAdjacent,
  canAddCellToPath,
  checkWin,
  createInitialPathZipGame,
  createPuzzleFromSolution,
  generateHamiltonianPath,
  generatePuzzle,
  generateSerpentinePath,
  generateWalls,
  getAllPossibleWalls,
  getCellKey,
  getNextSolutionCell,
  getNextRequiredNumber,
  getSolutionOrderMap,
  isCurrentPathOnSolution,
  isWallOnSolutionPath,
  normalizeWall,
  pickNumberedCellsFromPath,
  resetPath,
  shufflePathSegments,
  validateGeneratedPuzzle,
} from '../src/games/pathzip/logic.js'

function createSeededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function assertValidPath(path, rows, cols) {
  assert.equal(path.length, rows * cols)
  assert.equal(
    new Set(path.map(({ row, col }) => getCellKey(row, col))).size,
    path.length,
  )
  path.slice(1).forEach((cell, index) => {
    assert.equal(areAdjacent(path[index], cell), true)
  })
}

test('difficulty presets keep the harder wall counts', () => {
  assert.deepEqual(DIFFICULTIES.easy, {
    rows: 5,
    cols: 5,
    numberCount: 4,
    wallCount: 6,
  })
  assert.deepEqual(DIFFICULTIES.expert, {
    rows: 8,
    cols: 8,
    numberCount: 10,
    wallCount: 24,
  })
})

test('generateSerpentinePath creates a complete unique adjacent path', () => {
  assertValidPath(generateSerpentinePath(5, 5, () => 0.1), 5, 5)
  assertValidPath(generateSerpentinePath(6, 6, () => 0.9), 6, 6)
})

test('shufflePathSegments preserves a Hamiltonian path', () => {
  const base = generateSerpentinePath(7, 7, () => 0.1)
  const shuffled = shufflePathSegments(
    base,
    7,
    7,
    createSeededRandom(42),
  )

  assertValidPath(shuffled, 7, 7)
  assert.notDeepEqual(shuffled, base)
})

test('generateHamiltonianPath creates irregular complete paths', () => {
  const path = generateHamiltonianPath(
    8,
    8,
    createSeededRandom(2026),
  )

  assertValidPath(path, 8, 8)
  const directions = path.slice(1).map((cell, index) => {
    const previous = path[index]
    return `${cell.row - previous.row}:${cell.col - previous.col}`
  })
  const turns = directions
    .slice(1)
    .filter((direction, index) => direction !== directions[index])
    .length
  assert.ok(turns >= 15)
})

test('pickNumberedCellsFromPath includes both endpoints in order', () => {
  const solution = generateHamiltonianPath(
    6,
    6,
    createSeededRandom(8),
  )
  const numbers = pickNumberedCellsFromPath(
    solution,
    6,
    createSeededRandom(9),
  )
  const indexes = numbers.map((number) =>
    solution.findIndex(
      (cell) => cell.row === number.row && cell.col === number.col,
    ),
  )

  assert.equal(numbers.length, 6)
  assert.equal(numbers[0].value, 1)
  assert.equal(indexes[0], 0)
  assert.equal(indexes.at(-1), solution.length - 1)
  assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b))
})

test('wall helpers normalize walls and list every board edge', () => {
  assert.equal(
    normalizeWall({ row: 1, col: 2 }, { row: 1, col: 1 }),
    normalizeWall({ row: 1, col: 1 }, { row: 1, col: 2 }),
  )
  assert.equal(getAllPossibleWalls(5, 5).length, 40)
})

test('generateWalls creates unique walls outside the solution', () => {
  const solution = generateHamiltonianPath(
    7,
    7,
    createSeededRandom(12),
  )
  const walls = generateWalls(
    7,
    7,
    solution,
    16,
    createSeededRandom(13),
  )
  const keys = walls.map((wall) => normalizeWall(wall.from, wall.to))

  assert.equal(walls.length, 16)
  assert.equal(new Set(keys).size, walls.length)
  assert.equal(
    walls.some((wall) => isWallOnSolutionPath(wall, solution)),
    false,
  )
})

for (const [difficulty, config] of Object.entries(DIFFICULTIES)) {
  test(`generatePuzzle creates a valid ${difficulty} puzzle`, () => {
    const puzzle = generatePuzzle(
      difficulty,
      createSeededRandom(config.rows * 100 + config.cols),
    )

    assert.equal(puzzle.rows, config.rows)
    assert.equal(puzzle.cols, config.cols)
    assert.equal(puzzle.solution.length, config.rows * config.cols)
    assert.equal(puzzle.numbers.length, config.numberCount)
    assert.equal(puzzle.walls.length, config.wallCount)
    assert.equal(validateGeneratedPuzzle(puzzle), true)
  })
}

test('createPuzzleFromSolution creates a valid puzzle', () => {
  const config = { ...DIFFICULTIES.normal, difficulty: 'normal' }
  const solution = generateSerpentinePath(6, 6, () => 0.1)
  const puzzle = createPuzzleFromSolution(
    config,
    solution,
    createSeededRandom(21),
  )

  assert.equal(validateGeneratedPuzzle(puzzle), true)
})

test('validateGeneratedPuzzle rejects duplicate solution cells', () => {
  const puzzle = generatePuzzle('easy', createSeededRandom(30))
  puzzle.solution[1] = { ...puzzle.solution[0] }
  assert.equal(validateGeneratedPuzzle(puzzle), false)
})

test('validateGeneratedPuzzle rejects non-adjacent solution steps', () => {
  const puzzle = generatePuzzle('easy', createSeededRandom(31))
  ;[puzzle.solution[1], puzzle.solution[12]] = [
    puzzle.solution[12],
    puzzle.solution[1],
  ]
  assert.equal(validateGeneratedPuzzle(puzzle), false)
})

test('validateGeneratedPuzzle rejects a wall on the solution', () => {
  const puzzle = generatePuzzle('easy', createSeededRandom(32))
  puzzle.walls[0] = {
    from: { ...puzzle.solution[0] },
    to: { ...puzzle.solution[1] },
  }
  assert.equal(validateGeneratedPuzzle(puzzle), false)
})

test('validateGeneratedPuzzle rejects incorrect difficulty counts', () => {
  const puzzle = generatePuzzle('hard', createSeededRandom(33))
  puzzle.numbers.pop()
  assert.equal(validateGeneratedPuzzle(puzzle), false)
})

test('mock random functions produce stable generated puzzles', () => {
  const first = generatePuzzle('hard', createSeededRandom(99))
  const second = generatePuzzle('hard', createSeededRandom(99))
  assert.deepEqual(first, second)
})

test('different random seeds produce different puzzles', () => {
  const first = generatePuzzle('hard', createSeededRandom(100))
  const second = generatePuzzle('hard', createSeededRandom(101))
  assert.notDeepEqual(first, second)
})

test('createInitialPathZipGame uses a generated puzzle', () => {
  const first = createInitialPathZipGame(
    'normal',
    createSeededRandom(200),
  )
  const second = createInitialPathZipGame(
    'normal',
    createSeededRandom(201),
  )

  assert.equal(validateGeneratedPuzzle(first.puzzle), true)
  assert.notDeepEqual(first.puzzle, second.puzzle)
  assert.deepEqual(first.path, [])
  assert.equal(first.status, 'ready')
})

test('hint returns the next cell when path matches the solution prefix', () => {
  const game = createInitialPathZipGame(
    'normal',
    createSeededRandom(250),
  )
  game.path = game.puzzle.solution.slice(0, 7)

  assert.equal(isCurrentPathOnSolution(game), true)
  assert.deepEqual(getNextSolutionCell(game), game.puzzle.solution[7])
})

test('isCurrentPathOnSolution rejects a path outside the solution prefix', () => {
  const game = createInitialPathZipGame(
    'normal',
    createSeededRandom(251),
  )
  const incorrectCell = game.puzzle.solution.find(
    (cell, index) =>
      index > 1 &&
      (cell.row !== game.puzzle.solution[1].row ||
        cell.col !== game.puzzle.solution[1].col),
  )
  game.path = [game.puzzle.solution[0], incorrectCell]

  assert.equal(isCurrentPathOnSolution(game), false)
  assert.equal(getNextSolutionCell(game), null)
})

test('solution order map contains every cell from one to board size', () => {
  const game = createInitialPathZipGame(
    'expert',
    createSeededRandom(252),
  )
  const orderMap = getSolutionOrderMap(game)
  const values = [...orderMap.values()]

  assert.equal(orderMap.size, game.puzzle.rows * game.puzzle.cols)
  assert.deepEqual(
    values,
    Array.from({ length: game.puzzle.rows * game.puzzle.cols }, (_, index) => index + 1),
  )
})

test('number order and walls still restrict movement', () => {
  const game = createInitialPathZipGame(
    'normal',
    createSeededRandom(300),
  )
  const numberTwo = game.puzzle.numbers[1]
  assert.equal(getNextRequiredNumber(game), 1)
  assert.equal(
    canAddCellToPath(game, numberTwo.row, numberTwo.col),
    false,
  )

  const wall = game.puzzle.walls[0]
  const wallGame = {
    ...game,
    path: [wall.from],
    status: 'playing',
  }
  assert.equal(
    canAddCellToPath(wallGame, wall.to.row, wall.to.col),
    false,
  )
})

test('following any generated solution wins', () => {
  for (let seed = 0; seed < 20; seed += 1) {
    let game = createInitialPathZipGame(
      seed % 2 === 0 ? 'hard' : 'expert',
      createSeededRandom(400 + seed),
    )

    game.puzzle.solution.forEach((cell) => {
      game = addCellToPath(game, cell.row, cell.col)
    })

    assert.equal(checkWin(game), true)
    assert.equal(game.status, 'won')
  }
})

test('resetPath can preserve or reset timer and moves', () => {
  const game = {
    ...createInitialPathZipGame('easy', createSeededRandom(500)),
    path: [{ row: 0, col: 0 }],
    status: 'playing',
    elapsedTime: 15,
    moves: 4,
  }

  const cleared = resetPath(game, false)
  assert.equal(cleared.elapsedTime, 15)
  assert.equal(cleared.moves, 4)
  assert.deepEqual(cleared.path, [])

  const restarted = resetPath(game)
  assert.equal(restarted.elapsedTime, 0)
  assert.equal(restarted.moves, 0)
  assert.deepEqual(restarted.path, [])
})
