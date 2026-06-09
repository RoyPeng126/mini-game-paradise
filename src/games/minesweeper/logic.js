export const DIFFICULTIES = {
  easy: {
    rows: 9,
    cols: 9,
    mines: 10,
  },
  medium: {
    rows: 16,
    cols: 16,
    mines: 40,
  },
  hard: {
    rows: 16,
    cols: 30,
    mines: 99,
  },
}

export function createEmptyBoard(rows, cols) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    })),
  )
}

export function cloneBoard(board) {
  return board.map((row) => row.map((cell) => ({ ...cell })))
}

export function createInitialMinesweeperGame(difficulty = 'easy') {
  const selectedDifficulty = DIFFICULTIES[difficulty]
    ? difficulty
    : 'easy'
  const config = DIFFICULTIES[selectedDifficulty]

  return {
    difficulty: selectedDifficulty,
    rows: config.rows,
    cols: config.cols,
    mines: config.mines,
    board: createEmptyBoard(config.rows, config.cols),
    status: 'ready',
    flagsUsed: 0,
    revealedCount: 0,
    elapsedTime: 0,
    firstClick: true,
  }
}

export function getNeighbors(board, row, col) {
  const neighbors = []

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue

      const neighborRow = row + rowOffset
      const neighborCol = col + colOffset

      if (
        neighborRow >= 0 &&
        neighborRow < board.length &&
        neighborCol >= 0 &&
        neighborCol < board[neighborRow].length
      ) {
        neighbors.push(board[neighborRow][neighborCol])
      }
    }
  }

  return neighbors
}

export function placeMines(
  board,
  mineCount,
  safeRow,
  safeCol,
  randomFn = Math.random,
) {
  const nextBoard = cloneBoard(board)
  const safeCells = new Set(
    [
      nextBoard[safeRow]?.[safeCol],
      ...getNeighbors(nextBoard, safeRow, safeCol),
    ]
      .filter(Boolean)
      .map((cell) => `${cell.row}-${cell.col}`),
  )

  let candidates = nextBoard
    .flat()
    .filter((cell) => !safeCells.has(`${cell.row}-${cell.col}`))

  if (candidates.length < mineCount) {
    candidates = nextBoard
      .flat()
      .filter((cell) => cell.row !== safeRow || cell.col !== safeCol)
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(randomFn() * (index + 1))
    ;[candidates[index], candidates[randomIndex]] = [
      candidates[randomIndex],
      candidates[index],
    ]
  }

  candidates.slice(0, mineCount).forEach((cell) => {
    nextBoard[cell.row][cell.col].isMine = true
  })

  return nextBoard
}

export function calculateAdjacentMines(board) {
  const nextBoard = cloneBoard(board)

  nextBoard.flat().forEach((cell) => {
    cell.adjacentMines = cell.isMine
      ? 0
      : getNeighbors(nextBoard, cell.row, cell.col).filter(
          (neighbor) => neighbor.isMine,
        ).length
  })

  return nextBoard
}

export function revealEmptyArea(board, row, col) {
  const nextBoard = cloneBoard(board)
  const queue = [[row, col]]
  const visited = new Set()

  while (queue.length > 0) {
    const [currentRow, currentCol] = queue.shift()
    const key = `${currentRow}-${currentCol}`
    if (visited.has(key)) continue
    visited.add(key)

    const cell = nextBoard[currentRow]?.[currentCol]
    if (!cell || cell.isMine || cell.isFlagged) continue

    cell.isRevealed = true
    if (cell.adjacentMines > 0) continue

    getNeighbors(nextBoard, currentRow, currentCol).forEach((neighbor) => {
      if (!neighbor.isMine && !neighbor.isFlagged && !neighbor.isRevealed) {
        queue.push([neighbor.row, neighbor.col])
      }
    })
  }

  return nextBoard
}

export function revealAllMines(board) {
  const nextBoard = cloneBoard(board)
  nextBoard.flat().forEach((cell) => {
    if (cell.isMine) cell.isRevealed = true
  })
  return nextBoard
}

export function checkWin(gameState) {
  return gameState.board
    .flat()
    .every((cell) => cell.isMine || cell.isRevealed)
}

export function revealCell(
  gameState,
  row,
  col,
  randomFn = Math.random,
) {
  if (['won', 'lost'].includes(gameState.status)) return gameState

  const selectedCell = gameState.board[row]?.[col]
  if (!selectedCell || selectedCell.isFlagged || selectedCell.isRevealed) {
    return gameState
  }

  let board = cloneBoard(gameState.board)
  let status = gameState.status
  let firstClick = gameState.firstClick

  if (firstClick) {
    board = placeMines(board, gameState.mines, row, col, randomFn)
    board = calculateAdjacentMines(board)
    status = 'playing'
    firstClick = false
  }

  const cell = board[row][col]
  if (cell.isMine) {
    return {
      ...gameState,
      board: revealAllMines(board),
      status: 'lost',
      firstClick,
    }
  }

  board =
    cell.adjacentMines === 0
      ? revealEmptyArea(board, row, col)
      : cloneBoard(board)

  if (cell.adjacentMines > 0) {
    board[row][col].isRevealed = true
  }

  const revealedCount = board
    .flat()
    .filter((boardCell) => boardCell.isRevealed && !boardCell.isMine).length
  const nextState = {
    ...gameState,
    board,
    status,
    firstClick,
    revealedCount,
  }

  if (checkWin(nextState)) {
    return {
      ...nextState,
      status: 'won',
    }
  }

  return nextState
}

export function toggleFlag(gameState, row, col) {
  if (['won', 'lost'].includes(gameState.status)) return gameState

  const cell = gameState.board[row]?.[col]
  if (!cell || cell.isRevealed) return gameState
  if (!cell.isFlagged && gameState.flagsUsed >= gameState.mines) {
    return gameState
  }

  const board = cloneBoard(gameState.board)
  board[row][col].isFlagged = !board[row][col].isFlagged

  return {
    ...gameState,
    board,
    flagsUsed: gameState.flagsUsed + (board[row][col].isFlagged ? 1 : -1),
  }
}

export function resetMinesweeperGame(difficulty = 'easy') {
  return createInitialMinesweeperGame(difficulty)
}

export function getRemainingFlags(gameState) {
  return Math.max(gameState.mines - gameState.flagsUsed, 0)
}
