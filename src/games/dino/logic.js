export const DEFAULT_GAME_WIDTH = 800
export const DEFAULT_GAME_HEIGHT = 260
export const DEFAULT_GROUND_Y = 220
export const FRAME_DURATION = 1000 / 60

export function createDino(groundY = DEFAULT_GROUND_Y) {
  const height = 48

  return {
    x: 80,
    y: groundY - height,
    width: 44,
    height,
    velocityY: 0,
    isJumping: false,
  }
}

export function createInitialDinoGame() {
  return {
    dino: createDino(),
    obstacles: [],
    score: 0,
    speed: 6,
    gravity: 0.8,
    jumpForce: -14,
    groundY: DEFAULT_GROUND_Y,
    gameWidth: DEFAULT_GAME_WIDTH,
    gameHeight: DEFAULT_GAME_HEIGHT,
    status: 'ready',
    lastSpawnDistance: 0,
    distance: 0,
  }
}

export function createObstacle(
  gameWidth,
  groundY,
  randomFn = Math.random,
) {
  const width = Math.round(22 + randomFn() * 14)
  const height = Math.round(36 + randomFn() * 28)

  return {
    id: `cactus-${Math.round(randomFn() * 1_000_000_000)}`,
    type: 'cactus',
    x: gameWidth + 8,
    y: groundY - height,
    width,
    height,
  }
}

export function jump(gameState) {
  if (
    gameState.status === 'paused' ||
    gameState.status === 'gameOver' ||
    gameState.dino.isJumping
  ) {
    return gameState
  }

  return {
    ...gameState,
    status: gameState.status === 'ready' ? 'playing' : gameState.status,
    dino: {
      ...gameState.dino,
      velocityY: gameState.jumpForce,
      isJumping: true,
    },
  }
}

export function updateDinoPhysics(gameState, frameScale = 1) {
  if (gameState.status !== 'playing') return gameState

  const velocityY = gameState.dino.velocityY + gameState.gravity * frameScale
  const nextY = gameState.dino.y + velocityY * frameScale
  const groundPosition = gameState.groundY - gameState.dino.height

  if (nextY >= groundPosition) {
    return {
      ...gameState,
      dino: {
        ...gameState.dino,
        y: groundPosition,
        velocityY: 0,
        isJumping: false,
      },
    }
  }

  return {
    ...gameState,
    dino: {
      ...gameState.dino,
      y: nextY,
      velocityY,
      isJumping: true,
    },
  }
}

export function updateObstacles(gameState, frameScale = 1) {
  if (gameState.status !== 'playing') return gameState

  const travelled = gameState.speed * frameScale
  const obstacles = gameState.obstacles
    .map((obstacle) => ({
      ...obstacle,
      x: obstacle.x - travelled,
    }))
    .filter((obstacle) => obstacle.x + obstacle.width > 0)

  return {
    ...gameState,
    obstacles,
    distance: gameState.distance + travelled,
    lastSpawnDistance: gameState.lastSpawnDistance + travelled,
  }
}

export function shouldSpawnObstacle(gameState, randomFn = Math.random) {
  if (gameState.status !== 'playing') return false
  const requiredDistance = 260 + randomFn() * 180
  return gameState.lastSpawnDistance >= requiredDistance
}

export function spawnObstacle(gameState, randomFn = Math.random) {
  if (gameState.status !== 'playing') return gameState

  return {
    ...gameState,
    obstacles: [
      ...gameState.obstacles,
      createObstacle(gameState.gameWidth, gameState.groundY, randomFn),
    ],
    lastSpawnDistance: 0,
  }
}

export function checkCollision(rectA, rectB) {
  return (
    rectA.x < rectB.x + rectB.width &&
    rectA.x + rectA.width > rectB.x &&
    rectA.y < rectB.y + rectB.height &&
    rectA.y + rectA.height > rectB.y
  )
}

export function checkGameOver(gameState) {
  if (gameState.status !== 'playing') return gameState

  const collisionBox = {
    x: gameState.dino.x + 4,
    y: gameState.dino.y + 3,
    width: gameState.dino.width - 8,
    height: gameState.dino.height - 5,
  }
  const collided = gameState.obstacles.some((obstacle) =>
    checkCollision(collisionBox, obstacle),
  )

  return collided ? { ...gameState, status: 'gameOver' } : gameState
}

export function calculateSpeed(score) {
  return Math.min(16, 6 + Math.floor(score / 100) * 0.5)
}

export function updateGameState(
  gameState,
  deltaTime,
  randomFn = Math.random,
) {
  if (gameState.status !== 'playing') return gameState

  const safeDelta = Math.max(0, Math.min(deltaTime, 50))
  const frameScale = safeDelta / FRAME_DURATION
  const score = gameState.score + safeDelta / 100
  let nextState = {
    ...gameState,
    score,
    speed: calculateSpeed(score),
  }

  nextState = updateDinoPhysics(nextState, frameScale)
  nextState = updateObstacles(nextState, frameScale)

  if (shouldSpawnObstacle(nextState, randomFn)) {
    nextState = spawnObstacle(nextState, randomFn)
  }

  return checkGameOver(nextState)
}

export function resetDinoGame() {
  return createInitialDinoGame()
}
