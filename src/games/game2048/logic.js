export const BOARD_SIZE = 4

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0))
}

export function addRandomTile(board) {
  const nextBoard = board.map((row) => [...row])
  const emptyCells = []

  nextBoard.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value === 0) emptyCells.push([rowIndex, columnIndex])
    })
  })

  if (emptyCells.length === 0) return nextBoard

  const [row, column] = emptyCells[Math.floor(Math.random() * emptyCells.length)]
  nextBoard[row][column] = Math.random() < 0.9 ? 2 : 4
  return nextBoard
}

function slideAndMerge(row) {
  const tiles = row.filter((value) => value !== 0)
  const merged = []
  let score = 0

  for (let index = 0; index < tiles.length; index += 1) {
    if (tiles[index] === tiles[index + 1]) {
      const value = tiles[index] * 2
      merged.push(value)
      score += value
      index += 1
    } else {
      merged.push(tiles[index])
    }
  }

  while (merged.length < BOARD_SIZE) merged.push(0)
  return { row: merged, score }
}

function boardsAreEqual(first, second) {
  return first.every((row, rowIndex) =>
    row.every((value, columnIndex) => value === second[rowIndex][columnIndex]),
  )
}

function transpose(board) {
  return board[0].map((_, columnIndex) =>
    board.map((row) => row[columnIndex]),
  )
}

export function moveLeft(board) {
  let score = 0
  const nextBoard = board.map((row) => {
    const result = slideAndMerge(row)
    score += result.score
    return result.row
  })

  return {
    board: nextBoard,
    score,
    moved: !boardsAreEqual(board, nextBoard),
  }
}

export function moveRight(board) {
  const reversed = board.map((row) => [...row].reverse())
  const result = moveLeft(reversed)
  const nextBoard = result.board.map((row) => [...row].reverse())

  return {
    board: nextBoard,
    score: result.score,
    moved: !boardsAreEqual(board, nextBoard),
  }
}

export function moveUp(board) {
  const result = moveLeft(transpose(board))
  const nextBoard = transpose(result.board)

  return {
    board: nextBoard,
    score: result.score,
    moved: !boardsAreEqual(board, nextBoard),
  }
}

export function moveDown(board) {
  const result = moveRight(transpose(board))
  const nextBoard = transpose(result.board)

  return {
    board: nextBoard,
    score: result.score,
    moved: !boardsAreEqual(board, nextBoard),
  }
}

export function canMove(board) {
  if (board.some((row) => row.includes(0))) return true

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const value = board[row][column]
      if (column < BOARD_SIZE - 1 && value === board[row][column + 1]) return true
      if (row < BOARD_SIZE - 1 && value === board[row + 1][column]) return true
    }
  }

  return false
}

export function isGameOver(board) {
  return !canMove(board)
}
