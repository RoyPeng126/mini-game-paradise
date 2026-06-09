import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  calculateScore,
  canMove,
  clearLines,
  createEmptyBoard,
  createInitialTetrisGame,
  hardDrop,
  isGameOver,
  lockPiece,
  movePiece,
  rotatePiece,
  softDrop,
  spawnNextPiece,
} from '../src/games/tetris/logic.js'

const piece = (type, shape) => ({ type, shape })

function fixedGame(overrides = {}) {
  return {
    board: createEmptyBoard(),
    currentPiece: piece('O', [[1, 1], [1, 1]]),
    nextPiece: piece('I', [[1, 1, 1, 1]]),
    position: { row: 0, col: 4 },
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
    ...overrides,
  }
}

test('createEmptyBoard creates a 20 by 10 board', () => {
  const board = createEmptyBoard()
  assert.equal(board.length, BOARD_HEIGHT)
  assert.equal(board.every((row) => row.length === BOARD_WIDTH), true)
})

test('createInitialTetrisGame includes current and next pieces', () => {
  const game = createInitialTetrisGame(() => 0)
  assert.notEqual(game.currentPiece, null)
  assert.notEqual(game.nextPiece, null)
})

test('rotatePiece rotates a piece clockwise', () => {
  const rotated = rotatePiece(piece('T', [[0, 1, 0], [1, 1, 1]]))
  assert.deepEqual(rotated.shape, [[1, 0], [1, 1], [1, 0]])
})

test('canMove accepts a legal position', () => {
  assert.equal(
    canMove(createEmptyBoard(), piece('O', [[1, 1], [1, 1]]), {
      row: 0,
      col: 4,
    }),
    true,
  )
})

test('canMove rejects the left boundary', () => {
  assert.equal(
    canMove(createEmptyBoard(), piece('O', [[1, 1], [1, 1]]), {
      row: 0,
      col: -1,
    }),
    false,
  )
})

test('canMove rejects the right boundary', () => {
  assert.equal(
    canMove(createEmptyBoard(), piece('O', [[1, 1], [1, 1]]), {
      row: 0,
      col: 9,
    }),
    false,
  )
})

test('canMove rejects the bottom boundary', () => {
  assert.equal(
    canMove(createEmptyBoard(), piece('O', [[1, 1], [1, 1]]), {
      row: 19,
      col: 4,
    }),
    false,
  )
})

test('movePiece moves left', () => {
  assert.equal(movePiece(fixedGame(), 'left').position.col, 3)
})

test('movePiece moves right', () => {
  assert.equal(movePiece(fixedGame(), 'right').position.col, 5)
})

test('softDrop moves the piece down and adds one point', () => {
  const result = softDrop(fixedGame())
  assert.equal(result.position.row, 1)
  assert.equal(result.score, 1)
})

test('hardDrop moves to the bottom and locks the piece', () => {
  const result = hardDrop(fixedGame())
  assert.equal(result.board[18][4], 'O')
  assert.equal(result.board[19][5], 'O')
  assert.equal(result.score, 36)
})

test('lockPiece writes the current piece into the board', () => {
  const result = lockPiece(fixedGame({ position: { row: 18, col: 4 } }))
  assert.equal(result.board[18][4], 'O')
  assert.equal(result.board[19][5], 'O')
})

test('clearLines removes a full row', () => {
  const board = createEmptyBoard()
  board[19] = Array(BOARD_WIDTH).fill('I')
  board[18][0] = 'T'
  const result = clearLines(board)
  assert.equal(result.linesCleared, 1)
  assert.equal(result.board[19][0], 'T')
  assert.equal(result.board[0].every((cell) => cell === null), true)
})

test('calculateScore returns classic simplified line scores', () => {
  assert.equal(calculateScore(1, 2), 200)
  assert.equal(calculateScore(2, 2), 600)
  assert.equal(calculateScore(3, 2), 1000)
  assert.equal(calculateScore(4, 2), 1600)
})

test('level increases for every ten cleared lines', () => {
  const board = createEmptyBoard()
  board[18] = Array(BOARD_WIDTH).fill('I')
  board[19] = Array(BOARD_WIDTH).fill('I')
  const game = fixedGame({
    board,
    currentPiece: piece('I', [[1]]),
    position: { row: 17, col: 0 },
    lines: 9,
  })
  const result = lockPiece(game)
  assert.equal(result.lines, 11)
  assert.equal(result.level, 2)
})

test('spawnNextPiece promotes nextPiece and creates a new preview', () => {
  const result = spawnNextPiece(fixedGame(), () => 0)
  assert.equal(result.currentPiece.type, 'I')
  assert.equal(result.nextPiece.type, 'I')
  assert.notEqual(result.currentPiece, result.nextPiece)
})

test('isGameOver detects a blocked spawn position', () => {
  const board = createEmptyBoard()
  board[0][4] = 'T'
  assert.equal(isGameOver(fixedGame({ board })), true)
})
