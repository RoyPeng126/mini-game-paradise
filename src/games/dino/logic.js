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
    lastObstacleType: null,
    lastObstacleVariant: null,
    distance: 0,
  }
}

export function getFlyingDragonSpawnChance(score) {
  if (score < 200) return 0
  if (score < 500) return 0.3
  if (score < 1000) return 0.45
  return 0.55
}

export function getObstacleTypeForScore(
  score,
  randomFn = Math.random,
) {
  return randomFn() < getFlyingDragonSpawnChance(score)
    ? 'flyingDragon'
    : 'cactus'
}

export function createCactusObstacle(
  gameWidth,
  groundY,
  randomFn = Math.random,
) {
  const variant = randomFn() < 0.55 ? 'small' : 'tall'
  const width =
    variant === 'small'
      ? Math.round(22 + randomFn() * 8)
      : Math.round(28 + randomFn() * 8)
  const height =
    variant === 'small'
      ? Math.round(36 + randomFn() * 10)
      : Math.round(52 + randomFn() * 12)

  return {
    id: `cactus-${Math.round(randomFn() * 1_000_000_000)}`,
    type: 'cactus',
    x: gameWidth + 8,
    y: groundY - height,
    width,
    height,
    variant,
  }
}

export function createFlyingDragonObstacle(
  gameWidth,
  groundY,
  randomFn = Math.random,
) {
  const variant = randomFn() < 0.55 ? 'low' : 'high'
  const width = 52
  const height = 34
  const bottomOffset = variant === 'low' ? 36 : 120

  return {
    id: `flying-dragon-${Math.round(randomFn() * 1_000_000_000)}`,
    type: 'flyingDragon',
    x: gameWidth + 8,
    y: groundY - bottomOffset - height,
    width,
    height,
    variant,
  }
}

export function createObstacle(
  gameWidth,
  groundY,
  score = 0,
  randomFn = Math.random,
) {
  const resolvedScore = typeof score === 'function' ? 0 : score
  const resolvedRandomFn =
    typeof score === 'function' ? score : randomFn

  return getObstacleTypeForScore(
    resolvedScore,
    resolvedRandomFn,
  ) === 'flyingDragon'
    ? createFlyingDragonObstacle(
        gameWidth,
        groundY,
        resolvedRandomFn,
      )
    : createCactusObstacle(gameWidth, groundY, resolvedRandomFn)
}

export function isFlyingObstacle(obstacle) {
  return obstacle?.type === 'flyingDragon'
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

export function calculateSpawnGap(speed, randomFn = Math.random) {
  const speedReduction = Math.min(70, Math.max(0, speed - 6) * 7)
  return Math.max(235, 330 - speedReduction + randomFn() * 150)
}

export function shouldSpawnObstacle(gameState, randomFn = Math.random) {
  if (gameState.status !== 'playing') return false
  let requiredDistance = calculateSpawnGap(gameState.speed, randomFn)
  if (
    gameState.lastObstacleType === 'cactus' ||
    gameState.lastObstacleVariant === 'low'
  ) {
    requiredDistance += 55
  }
  return gameState.lastSpawnDistance >= requiredDistance
}

export function spawnObstacle(gameState, randomFn = Math.random) {
  if (gameState.status !== 'playing') return gameState
  const obstacle = createObstacle(
    gameState.gameWidth,
    gameState.groundY,
    gameState.score,
    randomFn,
  )

  return {
    ...gameState,
    lastObstacleType: obstacle.type,
    lastObstacleVariant: obstacle.variant,
    obstacles: [
      ...gameState.obstacles,
      obstacle,
    ],
    lastSpawnDistance: 0,
  }
}

export function getCollisionBox(entity) {
  const isDragon = isFlyingObstacle(entity)
  const horizontalPadding = isDragon ? 6 : 4
  const verticalPadding = isDragon ? 4 : 3

  return {
    x: entity.x + horizontalPadding,
    y: entity.y + verticalPadding,
    width: Math.max(0, entity.width - horizontalPadding * 2),
    height: Math.max(0, entity.height - verticalPadding * 2),
  }
}

export function checkCollision(rectA, rectB) {
  const boxA = getCollisionBox(rectA)
  const boxB = getCollisionBox(rectB)

  return (
    boxA.x < boxB.x + boxB.width &&
    boxA.x + boxA.width > boxB.x &&
    boxA.y < boxB.y + boxB.height &&
    boxA.y + boxA.height > boxB.y
  )
}

export function checkGameOver(gameState) {
  if (gameState.status !== 'playing') return gameState

  const collided = gameState.obstacles.some((obstacle) =>
    checkCollision(gameState.dino, obstacle),
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
