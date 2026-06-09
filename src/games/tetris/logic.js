export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20

export const PIECES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
}

const PIECE_TYPES = Object.keys(PIECES)

function cloneBoard(board) {
  return board.map((row) => [...row])
}

function clonePiece(piece) {
  return piece
    ? { ...piece, shape: piece.shape.map((row) => [...row]) }
    : null
}

function createPiece(type) {
  return {
    type,
    shape: PIECES[type].map((row) => [...row]),
  }
}

function getSpawnPosition(piece) {
  return {
    row: 0,
    col: Math.floor((BOARD_WIDTH - piece.shape[0].length) / 2),
  }
}

export function createEmptyBoard() {
  return Array.from(
    { length: BOARD_HEIGHT },
    () => Array(BOARD_WIDTH).fill(null),
  )
}

export function getRandomPiece(randomFn = Math.random) {
  const index = Math.min(
    PIECE_TYPES.length - 1,
    Math.floor(randomFn() * PIECE_TYPES.length),
  )
  return createPiece(PIECE_TYPES[index])
}

export function createInitialTetrisGame(randomFn = Math.random) {
  const currentPiece = getRandomPiece(randomFn)
  const nextPiece = getRandomPiece(randomFn)

  return {
    board: createEmptyBoard(),
    currentPiece,
    nextPiece,
    position: getSpawnPosition(currentPiece),
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
  }
}

export function rotatePiece(piece) {
  if (!piece) return null
  if (piece.type === 'O') return clonePiece(piece)

  const height = piece.shape.length
  const width = piece.shape[0].length
  const shape = Array.from(
    { length: width },
    (_, column) =>
      Array.from(
        { length: height },
        (_, row) => piece.shape[height - 1 - row][column],
      ),
  )

  return { ...piece, shape }
}

export function canMove(board, piece, position) {
  if (!piece || !position) return false

  for (let row = 0; row < piece.shape.length; row += 1) {
    for (let column = 0; column < piece.shape[row].length; column += 1) {
      if (!piece.shape[row][column]) continue

      const boardRow = position.row + row
      const boardColumn = position.col + column
      if (
        boardColumn < 0 ||
        boardColumn >= BOARD_WIDTH ||
        boardRow >= BOARD_HEIGHT
      ) {
        return false
      }
      if (boardRow >= 0 && board[boardRow][boardColumn]) return false
    }
  }

  return true
}

export function movePiece(gameState, direction) {
  if (gameState.status !== 'playing') return gameState

  const columnOffset = direction === 'left' ? -1 : direction === 'right' ? 1 : 0
  if (columnOffset === 0) return gameState

  const position = {
    ...gameState.position,
    col: gameState.position.col + columnOffset,
  }
  if (!canMove(gameState.board, gameState.currentPiece, position)) {
    return gameState
  }

  return { ...gameState, position }
}

export function rotateCurrentPiece(gameState) {
  if (gameState.status !== 'playing') return gameState
  const currentPiece = rotatePiece(gameState.currentPiece)
  if (!canMove(gameState.board, currentPiece, gameState.position)) {
    return gameState
  }
  return { ...gameState, currentPiece }
}

export function softDrop(gameState) {
  if (gameState.status !== 'playing') return gameState

  const position = {
    ...gameState.position,
    row: gameState.position.row + 1,
  }
  if (canMove(gameState.board, gameState.currentPiece, position)) {
    return {
      ...gameState,
      position,
      score: gameState.score + 1,
    }
  }

  return lockPiece(gameState)
}

export function tick(gameState) {
  if (gameState.status !== 'playing') return gameState

  const position = {
    ...gameState.position,
    row: gameState.position.row + 1,
  }
  return canMove(gameState.board, gameState.currentPiece, position)
    ? { ...gameState, position }
    : lockPiece(gameState)
}

export function hardDrop(gameState) {
  if (gameState.status !== 'playing') return gameState

  let distance = 0
  let position = { ...gameState.position }
  while (
    canMove(gameState.board, gameState.currentPiece, {
      ...position,
      row: position.row + 1,
    })
  ) {
    position.row += 1
    distance += 1
  }

  return lockPiece({
    ...gameState,
    position,
    score: gameState.score + distance * 2,
  })
}

export function clearLines(board) {
  const remainingRows = board.filter((row) => row.some((cell) => !cell))
  const linesCleared = BOARD_HEIGHT - remainingRows.length
  const emptyRows = Array.from(
    { length: linesCleared },
    () => Array(BOARD_WIDTH).fill(null),
  )

  return {
    board: [...emptyRows, ...remainingRows.map((row) => [...row])],
    linesCleared,
  }
}

export function calculateScore(linesCleared, level) {
  const lineScores = [0, 100, 300, 500, 800]
  return (lineScores[linesCleared] ?? 0) * level
}

export function spawnNextPiece(gameState, randomFn = Math.random) {
  const currentPiece = clonePiece(
    gameState.nextPiece ?? getRandomPiece(randomFn),
  )
  const nextPiece = getRandomPiece(randomFn)
  const position = getSpawnPosition(currentPiece)
  const nextState = {
    ...gameState,
    currentPiece,
    nextPiece,
    position,
  }

  return canMove(nextState.board, currentPiece, position)
    ? nextState
    : { ...nextState, status: 'gameOver' }
}

export function lockPiece(gameState, randomFn = Math.random) {
  if (!gameState.currentPiece) return gameState

  const board = cloneBoard(gameState.board)
  for (let row = 0; row < gameState.currentPiece.shape.length; row += 1) {
    for (
      let column = 0;
      column < gameState.currentPiece.shape[row].length;
      column += 1
    ) {
      if (!gameState.currentPiece.shape[row][column]) continue
      const boardRow = gameState.position.row + row
      const boardColumn = gameState.position.col + column
      if (boardRow < 0) {
        return { ...gameState, board, status: 'gameOver' }
      }
      board[boardRow][boardColumn] = gameState.currentPiece.type
    }
  }

  const cleared = clearLines(board)
  const lines = gameState.lines + cleared.linesCleared
  const level = Math.floor(lines / 10) + 1
  const scoredState = {
    ...gameState,
    board: cleared.board,
    score:
      gameState.score +
      calculateScore(cleared.linesCleared, gameState.level),
    lines,
    level,
  }

  return spawnNextPiece(scoredState, randomFn)
}

export function isGameOver(gameState) {
  return (
    gameState.status === 'gameOver' ||
    !canMove(
      gameState.board,
      gameState.currentPiece,
      gameState.position,
    )
  )
}
