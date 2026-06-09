import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SYMBOLS,
  calculatePayout,
  canSpin,
  createInitialSlotGame,
  getWeightedRandomSymbol,
  resetSlotGame,
  spin,
  spinReels,
} from '../src/games/slot/logic.js'

const symbol = (id) => SYMBOLS.find((item) => item.id === id)
const randomSequence = (...values) => {
  let index = 0
  return () => values[index++] ?? values[values.length - 1]
}

test('createInitialSlotGame starts with 100 credits', () => {
  assert.equal(createInitialSlotGame().credits, 100)
})

test('createInitialSlotGame starts with a bet of 10', () => {
  assert.equal(createInitialSlotGame().bet, 10)
})

test('canSpin returns true with enough credits', () => {
  assert.equal(canSpin(createInitialSlotGame()), true)
})

test('canSpin returns false with insufficient credits', () => {
  assert.equal(canSpin({ ...createInitialSlotGame(), credits: 5, bet: 10 }), false)
})

test('getWeightedRandomSymbol returns a valid symbol', () => {
  assert.equal(SYMBOLS.includes(getWeightedRandomSymbol(() => 0.4)), true)
})

test('spinReels returns three symbols', () => {
  const reels = spinReels(() => 0)
  assert.equal(reels.length, 3)
  assert.equal(reels.every((reel) => SYMBOLS.includes(reel)), true)
})

test('calculatePayout pays the full multiplier for three matches', () => {
  assert.equal(calculatePayout(Array(3).fill(symbol('seven')), 10), 300)
})

test('calculatePayout pays a partial multiplier for two matches', () => {
  assert.equal(
    calculatePayout([symbol('bell'), symbol('bell'), symbol('lemon')], 10),
    15,
  )
})

test('calculatePayout returns the bet for a single cherry', () => {
  assert.equal(
    calculatePayout([symbol('cherry'), symbol('star'), symbol('diamond')], 10),
    10,
  )
})

test('calculatePayout returns zero without a match or cherry', () => {
  assert.equal(
    calculatePayout([symbol('lemon'), symbol('star'), symbol('diamond')], 10),
    0,
  )
})

test('spin deducts the bet', () => {
  const result = spin(
    createInitialSlotGame(),
    randomSequence(0.4, 0.8, 0.92),
  )
  assert.equal(result.credits, 90)
})

test('spin adds a winning payout', () => {
  const result = spin(createInitialSlotGame(), () => 0)
  assert.equal(result.lastWin, 20)
  assert.equal(result.credits, 110)
})

test('spin increments totalSpins', () => {
  const result = spin(
    createInitialSlotGame(),
    randomSequence(0.4, 0.8, 0.92),
  )
  assert.equal(result.totalSpins, 1)
})

test('spin updates lastWin', () => {
  assert.equal(spin(createInitialSlotGame(), () => 0).lastWin, 20)
})

test('spin sets gameOver when credits reach zero', () => {
  const game = { ...createInitialSlotGame(), credits: 10, bet: 10 }
  const result = spin(game, randomSequence(0.4, 0.8, 0.92))
  assert.equal(result.status, 'gameOver')
})

test('resetSlotGame restores the initial state', () => {
  assert.deepEqual(resetSlotGame(), createInitialSlotGame())
})

test('spin never leaves a bet above remaining credits', () => {
  const game = { ...createInitialSlotGame(), credits: 30, bet: 30 }
  const result = spin(game, randomSequence(0.4, 0.8, 0.92))
  assert.equal(result.credits, 0)
  assert.equal(result.bet <= result.credits, true)
})

test('weighted random supports deterministic boundary selection', () => {
  assert.equal(getWeightedRandomSymbol(() => 0).id, 'cherry')
  assert.equal(getWeightedRandomSymbol(() => 0.999).id, 'seven')
})
