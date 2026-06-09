import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateSpeed,
  calculateSpawnGap,
  checkCollision,
  checkGameOver,
  createCactusObstacle,
  createDino,
  createFlyingDragonObstacle,
  createInitialDinoGame,
  createObstacle,
  getCollisionBox,
  getFlyingDragonSpawnChance,
  getObstacleTypeForScore,
  isFlyingObstacle,
  jump,
  resetDinoGame,
  spawnObstacle,
  updateDinoPhysics,
  updateGameState,
  updateObstacles,
} from '../src/games/dino/logic.js'

function playingGame(overrides = {}) {
  return {
    ...createInitialDinoGame(),
    status: 'playing',
    ...overrides,
  }
}

test('createInitialDinoGame creates a ready game', () => {
  assert.equal(createInitialDinoGame().status, 'ready')
})

test('createDino creates the expected size and ground position', () => {
  const dino = createDino(220)
  assert.equal(dino.width, 44)
  assert.equal(dino.height, 48)
  assert.equal(dino.x, 80)
  assert.equal(dino.y, 172)
})

test('jump makes a grounded dino jump', () => {
  const result = jump(playingGame())
  assert.equal(result.dino.isJumping, true)
  assert.equal(result.dino.velocityY, -14)
})

test('jump does not allow a second jump in the air', () => {
  const game = playingGame({
    dino: { ...createDino(), isJumping: true, velocityY: -8, y: 120 },
  })
  assert.equal(jump(game), game)
})

test('updateDinoPhysics applies gravity', () => {
  const game = playingGame({
    dino: { ...createDino(), y: 120, velocityY: -5, isJumping: true },
  })
  const result = updateDinoPhysics(game)
  assert.equal(result.dino.velocityY, -4.2)
  assert.equal(result.dino.y, 115.8)
})

test('updateDinoPhysics clears jumping after landing', () => {
  const game = playingGame({
    dino: { ...createDino(), y: 171, velocityY: 4, isJumping: true },
  })
  const result = updateDinoPhysics(game)
  assert.equal(result.dino.y, 172)
  assert.equal(result.dino.isJumping, false)
  assert.equal(result.dino.velocityY, 0)
})

test('createObstacle creates a cactus beyond the right edge', () => {
  const obstacle = createObstacle(800, 220, () => 0)
  assert.equal(obstacle.x > 800, true)
  assert.equal(obstacle.type, 'cactus')
  assert.equal(obstacle.y + obstacle.height, 220)
})

test('score below 200 only creates cactus obstacles', () => {
  assert.equal(createObstacle(800, 220, 199, () => 0).type, 'cactus')
  assert.equal(getObstacleTypeForScore(199, () => 0), 'cactus')
})

test('score at 200 can create a Flying Dragon', () => {
  assert.equal(
    createObstacle(800, 220, 200, () => 0).type,
    'flyingDragon',
  )
})

test('Flying Dragon spawn chance increases with score', () => {
  assert.equal(getFlyingDragonSpawnChance(199), 0)
  assert.equal(getFlyingDragonSpawnChance(200), 0.3)
  assert.equal(getFlyingDragonSpawnChance(500), 0.45)
  assert.equal(getFlyingDragonSpawnChance(1000), 0.55)
})

test('createCactusObstacle preserves ground alignment and variants', () => {
  const obstacle = createCactusObstacle(800, 220, () => 0)
  assert.equal(obstacle.type, 'cactus')
  assert.equal(obstacle.variant, 'small')
  assert.equal(obstacle.y + obstacle.height, 220)
})

test('createFlyingDragonObstacle creates an airborne dragon', () => {
  const obstacle = createFlyingDragonObstacle(800, 220, () => 0)
  assert.equal(obstacle.type, 'flyingDragon')
  assert.equal(obstacle.variant, 'low')
  assert.equal(obstacle.width, 52)
  assert.equal(obstacle.height, 34)
  assert.ok(obstacle.y + obstacle.height < 220)
})

test('low Flying Dragon collides with a standing dino but high does not', () => {
  const dino = createDino(220)
  const lowDragon = createFlyingDragonObstacle(800, 220, () => 0)
  const highRandomValues = [0.9, 0]
  let randomIndex = 0
  const highDragon = createFlyingDragonObstacle(
    800,
    220,
    () => highRandomValues[randomIndex++] ?? 0,
  )

  lowDragon.x = dino.x
  highDragon.x = dino.x

  assert.equal(checkCollision(dino, lowDragon), true)
  assert.equal(checkCollision(dino, highDragon), false)
})

test('isFlyingObstacle identifies only Flying Dragons', () => {
  assert.equal(
    isFlyingObstacle({ type: 'flyingDragon' }),
    true,
  )
  assert.equal(isFlyingObstacle({ type: 'cactus' }), false)
})

test('Flying Dragon collision boxes use larger padding', () => {
  const dragon = {
    type: 'flyingDragon',
    x: 100,
    y: 80,
    width: 52,
    height: 34,
  }
  assert.deepEqual(getCollisionBox(dragon), {
    x: 106,
    y: 84,
    width: 40,
    height: 26,
  })
})

test('updateObstacles moves obstacles left', () => {
  const game = playingGame({
    obstacles: [{ x: 300, y: 180, width: 20, height: 40 }],
  })
  assert.equal(updateObstacles(game).obstacles[0].x, 294)
})

test('updateObstacles moves Flying Dragons left', () => {
  const game = playingGame({
    obstacles: [
      {
        type: 'flyingDragon',
        x: 300,
        y: 100,
        width: 52,
        height: 34,
        variant: 'high',
      },
    ],
  })
  assert.equal(updateObstacles(game).obstacles[0].x, 294)
})

test('updateObstacles removes obstacles beyond the left edge', () => {
  const game = playingGame({
    obstacles: [{ x: -30, y: 180, width: 20, height: 40 }],
  })
  assert.equal(updateObstacles(game).obstacles.length, 0)
})

test('checkCollision returns true for overlapping rectangles', () => {
  assert.equal(
    checkCollision(
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 10, y: 10, width: 20, height: 20 },
    ),
    true,
  )
})

test('checkCollision returns false for separate rectangles', () => {
  assert.equal(
    checkCollision(
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 30, y: 30, width: 20, height: 20 },
    ),
    false,
  )
})

test('checkCollision detects a Flying Dragon collision', () => {
  assert.equal(
    checkCollision(
      { x: 80, y: 100, width: 44, height: 48 },
      {
        type: 'flyingDragon',
        x: 100,
        y: 110,
        width: 52,
        height: 34,
      },
    ),
    true,
  )
})

test('checkGameOver changes status after a collision', () => {
  const dino = createDino()
  const game = playingGame({
    dino,
    obstacles: [{ x: dino.x, y: dino.y, width: 20, height: 48 }],
  })
  assert.equal(checkGameOver(game).status, 'gameOver')
})

test('calculateSpeed increases with score', () => {
  assert.equal(calculateSpeed(0), 6)
  assert.equal(calculateSpeed(200), 7)
})

test('calculateSpeed is capped at sixteen', () => {
  assert.equal(calculateSpeed(10_000), 16)
})

test('updateGameState increases score while playing', () => {
  const result = updateGameState(playingGame(), 1000 / 60, () => 1)
  assert.equal(result.score > 0, true)
})

test('updateGameState does not update a paused game', () => {
  const game = { ...playingGame(), status: 'paused' }
  assert.equal(updateGameState(game, 1000, () => 0), game)
})

test('spawnObstacle adds an obstacle', () => {
  const result = spawnObstacle(playingGame(), () => 0)
  assert.equal(result.obstacles.length, 1)
})

test('spawnObstacle uses cactus at low score and dragons at high score', () => {
  const lowScore = spawnObstacle(
    playingGame({ score: 199 }),
    () => 0,
  )
  const highScore = spawnObstacle(
    playingGame({ score: 500 }),
    () => 0,
  )

  assert.equal(lowScore.obstacles[0].type, 'cactus')
  assert.equal(highScore.obstacles[0].type, 'flyingDragon')
  assert.equal(highScore.lastObstacleType, 'flyingDragon')
})

test('spawn gaps stay playable and shrink gradually with speed', () => {
  assert.ok(calculateSpawnGap(16, () => 0) >= 235)
  assert.ok(calculateSpawnGap(6, () => 0) > calculateSpawnGap(16, () => 0))
})

test('resetDinoGame returns to the initial ready state', () => {
  const result = resetDinoGame()
  assert.equal(result.status, 'ready')
  assert.equal(result.score, 0)
  assert.equal(result.obstacles.length, 0)
})
