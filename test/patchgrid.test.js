import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DIFFICULTIES,
  addOrReplacePlayerPatch,
  checkWin,
  containsExactlyOneClue,
  createInitialPatchGridGame,
  doPatchesOverlap,
  generatePatchPuzzle,
  getClueInsidePatch,
  getCoveredCellCount,
  getPatchArea,
  getPatchShape,
  getPatchAtCell,
  getSolutionMap,
  isCellInPatch,
  isValidPlayerPatch,
  normalizeSelection,
  removePlayerPatchAtCell,
  validateGeneratedPatchPuzzle,
} from '../src/games/patchgrid/logic.js'

function createSeededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

for (const [difficulty, config] of Object.entries(DIFFICULTIES)) {
  test(`generatePatchPuzzle creates a valid ${difficulty} puzzle`, () => {
    const puzzle = generatePatchPuzzle(
      difficulty,
      createSeededRandom(config.rows * 101),
    )

    assert.equal(puzzle.rows, config.rows)
    assert.equal(puzzle.cols, config.cols)
    assert.equal(puzzle.solutionPatches.length, config.patchCount)
    assert.equal(puzzle.clues.length, config.patchCount)
    assert.equal(validateGeneratedPatchPuzzle(puzzle), true)

    const covered = new Set()
    puzzle.solutionPatches.forEach((patch) => {
      assert.equal(patch.area, getPatchArea(patch))
      assert.ok(patch.area >= 2)
      assert.equal(containsExactlyOneClue(puzzle, patch), true)
      const clue = getClueInsidePatch(puzzle, patch)
      assert.ok(clue)
      assert.equal(isCellInPatch(clue.row, clue.col, patch), true)
      assert.equal(clue.area, patch.area)
      assert.deepEqual(getPatchShape(patch), {
        shape: clue.shape,
        orientation: clue.orientation,
      })
      assert.notEqual(clue.displayValue, 1)
      assert.equal(
        clue.displayValue,
        clue.isBlank ? null : patch.area,
      )

      for (let row = patch.top; row <= patch.bottom; row += 1) {
        for (let col = patch.left; col <= patch.right; col += 1) {
          const key = `${row}-${col}`
          assert.equal(covered.has(key), false)
          covered.add(key)
        }
      }
    })
    assert.equal(covered.size, config.rows * config.cols)
  })
}

test('geometry helpers normalize selections and detect cells and overlap', () => {
  const patch = normalizeSelection(
    { row: 3, col: 4 },
    { row: 1, col: 2 },
  )
  assert.deepEqual(patch, {
    top: 1,
    left: 2,
    bottom: 3,
    right: 4,
    area: 9,
  })
  assert.equal(getPatchArea(patch), 9)
  assert.equal(isCellInPatch(2, 3, patch), true)
  assert.equal(isCellInPatch(0, 3, patch), false)
  assert.equal(
    doPatchesOverlap(patch, {
      top: 3,
      left: 4,
      bottom: 4,
      right: 4,
    }),
    true,
  )
  assert.equal(
    doPatchesOverlap(patch, {
      top: 4,
      left: 0,
      bottom: 4,
      right: 1,
    }),
    false,
  )
})

test('clue helpers require exactly one clue', () => {
  const puzzle = generatePatchPuzzle('easy', createSeededRandom(20))
  const solution = puzzle.solutionPatches[0]
  assert.equal(containsExactlyOneClue(puzzle, solution), true)
  assert.equal(
    getClueInsidePatch(puzzle, solution).id,
    solution.clueId,
  )

  const noCluePatch = { top: 0, left: 0, bottom: 0, right: 0 }
  const clueCount = puzzle.clues.filter((clue) =>
    isCellInPatch(clue.row, clue.col, noCluePatch),
  ).length
  if (clueCount === 0) {
    assert.equal(containsExactlyOneClue(puzzle, noCluePatch), false)
  }
})

test('isValidPlayerPatch accepts a solution patch', () => {
  const game = createInitialPatchGridGame(
    'normal',
    createSeededRandom(30),
  )
  assert.equal(
    isValidPlayerPatch(game, game.puzzle.solutionPatches[0]),
    true,
  )
})

test('isValidPlayerPatch rejects no clue, multiple clues, and wrong area', () => {
  const game = createInitialPatchGridGame(
    'easy',
    createSeededRandom(31),
  )
  const clue = game.puzzle.clues[0]
  const noClueCell = Array.from(
    { length: game.puzzle.rows * game.puzzle.cols },
    (_, index) => ({
      row: Math.floor(index / game.puzzle.cols),
      col: index % game.puzzle.cols,
    }),
  ).find(
    (cell) =>
      !game.puzzle.clues.some(
        (candidate) =>
          candidate.row === cell.row && candidate.col === cell.col,
      ),
  )
  assert.equal(
    isValidPlayerPatch(game, {
      top: noClueCell.row,
      left: noClueCell.col,
      bottom: noClueCell.row,
      right: noClueCell.col,
    }),
    false,
  )
  assert.equal(
    isValidPlayerPatch(game, {
      top: 0,
      left: 0,
      bottom: game.puzzle.rows - 1,
      right: game.puzzle.cols - 1,
    }),
    false,
  )
  assert.equal(
    isValidPlayerPatch(game, {
      top: clue.row,
      left: clue.col,
      bottom: clue.row,
      right: clue.col,
    }),
    clue.displayValue === 1,
  )
})

test('blank clues enforce square or rectangle orientation', () => {
  const game = createInitialPatchGridGame(
    'expert',
    createSeededRandom(32),
  )
  const blankClue = game.puzzle.clues.find((clue) => clue.isBlank)
  const solution = game.puzzle.solutionPatches.find(
    (patch) => patch.clueId === blankClue.id,
  )
  const singleCell = {
    top: blankClue.row,
    left: blankClue.col,
    bottom: blankClue.row,
    right: blankClue.col,
  }
  assert.equal(
    isValidPlayerPatch(game, singleCell),
    blankClue.orientation === 'square',
  )
  assert.equal(isValidPlayerPatch(game, solution), true)
})

test('player patches can be added, replaced, rejected, and removed', () => {
  let game = createInitialPatchGridGame(
    'normal',
    createSeededRandom(40),
  )
  const first = game.puzzle.solutionPatches[0]
  game = addOrReplacePlayerPatch(game, first)
  assert.equal(game.playerPatches.length, 1)
  assert.equal(game.moves, 1)

  game = addOrReplacePlayerPatch(game, first)
  assert.equal(game.playerPatches.length, 1)

  const overlapping = {
    top: first.top,
    left: first.left,
    bottom: Math.min(first.bottom + 1, game.puzzle.rows - 1),
    right: first.right,
  }
  const rejected = addOrReplacePlayerPatch(game, overlapping)
  if (!isValidPlayerPatch(game, overlapping)) {
    assert.equal(rejected.mistakes, game.mistakes + 1)
  }

  const cell = game.playerPatches[0]
  assert.ok(getPatchAtCell(game, cell.top, cell.left))
  game = removePlayerPatchAtCell(game, cell.top, cell.left)
  assert.equal(game.playerPatches.length, 0)
})

test('covered cell count and solution map cover the board', () => {
  const game = createInitialPatchGridGame(
    'hard',
    createSeededRandom(50),
  )
  const solutionMap = getSolutionMap(game.puzzle)
  assert.equal(
    solutionMap.size,
    game.puzzle.rows * game.puzzle.cols,
  )

  const partial = {
    ...game,
    playerPatches: game.puzzle.solutionPatches.slice(0, 2),
  }
  assert.equal(
    getCoveredCellCount(partial),
    partial.playerPatches.reduce(
      (total, patch) => total + patch.area,
      0,
    ),
  )
})

test('matching every solution patch wins', () => {
  const game = createInitialPatchGridGame(
    'expert',
    createSeededRandom(60),
  )
  const completed = {
    ...game,
    playerPatches: game.puzzle.solutionPatches.map((patch) => ({
      ...patch,
      id: `player-${patch.id}`,
    })),
  }
  assert.equal(checkWin(completed), true)
})

test('any complete valid partition wins without matching hidden coordinates', () => {
  const puzzle = {
    difficulty: 'easy',
    rows: 2,
    cols: 2,
    clues: [
      {
        id: 'clue-1',
        row: 0,
        col: 0,
        area: 2,
        displayValue: 2,
        isBlank: false,
        shape: 'rectangle',
        orientation: 'vertical',
      },
      {
        id: 'clue-2',
        row: 1,
        col: 1,
        area: 2,
        displayValue: 2,
        isBlank: false,
        shape: 'rectangle',
        orientation: 'vertical',
      },
    ],
    solutionPatches: [
      {
        id: 'patch-1',
        top: 0,
        left: 0,
        bottom: 1,
        right: 0,
        area: 2,
        clueId: 'clue-1',
      },
      {
        id: 'patch-2',
        top: 0,
        left: 1,
        bottom: 1,
        right: 1,
        area: 2,
        clueId: 'clue-2',
      },
    ],
  }
  const game = {
    ...createInitialPatchGridGame(),
    puzzle,
    playerPatches: [
      {
        id: 'player-1',
        top: 0,
        left: 0,
        bottom: 0,
        right: 1,
        area: 2,
        clueId: 'clue-1',
      },
      {
        id: 'player-2',
        top: 1,
        left: 0,
        bottom: 1,
        right: 1,
        area: 2,
        clueId: 'clue-2',
      },
    ],
  }

  assert.equal(checkWin(game), true)
})

test('mock random and repeated generation always produce valid puzzles', () => {
  const first = generatePatchPuzzle('hard', createSeededRandom(70))
  const second = generatePatchPuzzle('hard', createSeededRandom(70))
  assert.deepEqual(first, second)

  for (let seed = 0; seed < 20; seed += 1) {
    const puzzle = generatePatchPuzzle(
      seed % 2 === 0 ? 'hard' : 'expert',
      createSeededRandom(100 + seed),
    )
    assert.equal(validateGeneratedPatchPuzzle(puzzle), true)
    assert.equal(
      puzzle.solutionPatches.some((patch) => patch.area === 1),
      false,
    )
  }
})
