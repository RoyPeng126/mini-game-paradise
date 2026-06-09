import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canMove,
  createEmptyBoard,
  isGameOver,
  moveDown,
  moveLeft,
  moveRight,
  moveUp,
} from '../src/games/game2048/logic.js'

test('createEmptyBoard creates a fresh 4x4 board', () => {
  const board = createEmptyBoard()
  assert.equal(board.length, 4)
  assert.ok(board.every((row) => row.length === 4 && row.every((tile) => tile === 0)))
  assert.notEqual(board[0], board[1])
})

test('moveLeft merges each tile once and does not mutate input', () => {
  const board = [
    [2, 2, 2, 2],
    [4, 0, 4, 4],
    [0, 0, 0, 0],
    [2, 4, 8, 16],
  ]
  const original = structuredClone(board)
  const result = moveLeft(board)

  assert.deepEqual(result.board, [
    [4, 4, 0, 0],
    [8, 4, 0, 0],
    [0, 0, 0, 0],
    [2, 4, 8, 16],
  ])
  assert.equal(result.score, 16)
  assert.equal(result.moved, true)
  assert.deepEqual(board, original)
})

test('direction moves transform the board correctly', () => {
  const board = [
    [2, 0, 0, 2],
    [2, 0, 0, 2],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]

  assert.deepEqual(moveRight(board).board[0], [0, 0, 0, 4])
  assert.deepEqual(moveUp(board).board[0], [4, 0, 0, 4])
  assert.deepEqual(moveDown(board).board[3], [4, 0, 0, 4])
})

test('game over is detected only when no empty cells or merges remain', () => {
  const lockedBoard = [
    [2, 4, 2, 4],
    [4, 2, 4, 2],
    [2, 4, 2, 4],
    [4, 2, 4, 2],
  ]

  assert.equal(canMove(lockedBoard), false)
  assert.equal(isGameOver(lockedBoard), true)

  lockedBoard[3][3] = 0
  assert.equal(canMove(lockedBoard), true)
  assert.equal(isGameOver(lockedBoard), false)
})
