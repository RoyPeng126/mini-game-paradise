import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DIFFICULTIES,
  calculateAdjacentMines,
  checkWin,
  cloneBoard,
  createEmptyBoard,
  createInitialMinesweeperGame,
  getNeighbors,
  getRemainingFlags,
  placeMines,
  resetMinesweeperGame,
  revealAllMines,
  revealCell,
  revealEmptyArea,
  toggleFlag,
} from '../src/games/minesweeper/logic.js'

test('difficulty presets match the requested board sizes', () => {
  assert.deepEqual(DIFFICULTIES.easy, { rows: 9, cols: 9, mines: 10 })
  assert.deepEqual(DIFFICULTIES.medium, { rows: 16, cols: 16, mines: 40 })
  assert.deepEqual(DIFFICULTIES.hard, { rows: 16, cols: 30, mines: 99 })
})

test('createEmptyBoard creates cells with coordinates and default state', () => {
  const board = createEmptyBoard(2, 3)

  assert.equal(board.length, 2)
  assert.equal(board[0].length, 3)
  assert.deepEqual(board[1][2], {
    row: 1,
    col: 2,
    isMine: false,
    isRevealed: false,
    isFlagged: false,
    adjacentMines: 0,
  })
})

test('initial game defaults to easy and does not place mines yet', () => {
  const game = createInitialMinesweeperGame()

  assert.equal(game.difficulty, 'easy')
  assert.equal(game.status, 'ready')
  assert.equal(game.firstClick, true)
  assert.equal(game.board.flat().some((cell) => cell.isMine), false)
})

test('cloneBoard makes independent cell copies', () => {
  const board = createEmptyBoard(2, 2)
  const clone = cloneBoard(board)
  clone[0][0].isMine = true

  assert.equal(board[0][0].isMine, false)
})

test('getNeighbors returns three corner neighbors and eight center neighbors', () => {
  const board = createEmptyBoard(3, 3)

  assert.equal(getNeighbors(board, 0, 0).length, 3)
  assert.equal(getNeighbors(board, 1, 1).length, 8)
})

test('placeMines places the requested number away from the first click', () => {
  const board = placeMines(createEmptyBoard(9, 9), 10, 4, 4, () => 0)

  assert.equal(board.flat().filter((cell) => cell.isMine).length, 10)
  assert.equal(board[4][4].isMine, false)
  assert.equal(
    getNeighbors(board, 4, 4).some((cell) => cell.isMine),
    false,
  )
})

test('calculateAdjacentMines counts surrounding mines', () => {
  const board = createEmptyBoard(3, 3)
  board[0][0].isMine = true
  board[2][2].isMine = true
  const counted = calculateAdjacentMines(board)

  assert.equal(counted[0][1].adjacentMines, 1)
  assert.equal(counted[1][1].adjacentMines, 2)
})

test('first reveal places mines and always keeps the selected cell safe', () => {
  const result = revealCell(createInitialMinesweeperGame('easy'), 0, 0, () => 0)

  assert.equal(result.firstClick, false)
  assert.equal(result.status, 'playing')
  assert.equal(result.board[0][0].isMine, false)
  assert.equal(result.board[0][0].isRevealed, true)
  assert.equal(result.board.flat().filter((cell) => cell.isMine).length, 10)
})

test('revealEmptyArea expands blank cells and their numbered border', () => {
  const board = createEmptyBoard(3, 3)
  board[2][2].isMine = true
  const counted = calculateAdjacentMines(board)
  const revealed = revealEmptyArea(counted, 0, 0)

  assert.equal(revealed[0][0].isRevealed, true)
  assert.equal(revealed[1][1].isRevealed, true)
  assert.equal(revealed[2][2].isRevealed, false)
})

test('flagged cells cannot be revealed', () => {
  let game = createInitialMinesweeperGame()
  game = toggleFlag(game, 0, 0)

  assert.equal(revealCell(game, 0, 0), game)
})

test('toggleFlag adds and removes flags within the mine limit', () => {
  let game = createInitialMinesweeperGame()
  game = toggleFlag(game, 0, 0)

  assert.equal(game.board[0][0].isFlagged, true)
  assert.equal(game.flagsUsed, 1)
  assert.equal(getRemainingFlags(game), 9)

  game = toggleFlag(game, 0, 0)
  assert.equal(game.board[0][0].isFlagged, false)
  assert.equal(game.flagsUsed, 0)
})

test('toggleFlag refuses revealed cells and flags beyond the mine count', () => {
  const revealedGame = createInitialMinesweeperGame()
  revealedGame.board[0][0].isRevealed = true
  assert.equal(toggleFlag(revealedGame, 0, 0), revealedGame)

  const fullFlagsGame = {
    ...createInitialMinesweeperGame(),
    flagsUsed: 10,
  }
  assert.equal(toggleFlag(fullFlagsGame, 0, 0), fullFlagsGame)
})

test('revealing a mine loses and reveals every mine', () => {
  const board = calculateAdjacentMines(createEmptyBoard(2, 2))
  board[1][1].isMine = true
  const game = {
    ...createInitialMinesweeperGame(),
    rows: 2,
    cols: 2,
    mines: 1,
    board,
    status: 'playing',
    firstClick: false,
  }
  const result = revealCell(game, 1, 1)

  assert.equal(result.status, 'lost')
  assert.equal(result.board[1][1].isRevealed, true)
})

test('revealing every safe cell wins the game', () => {
  const board = createEmptyBoard(2, 2)
  board[1][1].isMine = true
  board[0][0].isRevealed = true
  board[0][1].isRevealed = true
  const game = {
    ...createInitialMinesweeperGame(),
    rows: 2,
    cols: 2,
    mines: 1,
    board: calculateAdjacentMines(board),
    status: 'playing',
    firstClick: false,
    revealedCount: 2,
  }
  const result = revealCell(game, 1, 0)

  assert.equal(checkWin(result), true)
  assert.equal(result.status, 'won')
})

test('revealAllMines only reveals mine cells', () => {
  const board = createEmptyBoard(2, 2)
  board[0][1].isMine = true
  const result = revealAllMines(board)

  assert.equal(result[0][1].isRevealed, true)
  assert.equal(result[0][0].isRevealed, false)
})

test('resetMinesweeperGame creates a fresh selected difficulty', () => {
  const game = resetMinesweeperGame('hard')

  assert.equal(game.difficulty, 'hard')
  assert.equal(game.rows, 16)
  assert.equal(game.cols, 30)
  assert.equal(game.elapsedTime, 0)
})
