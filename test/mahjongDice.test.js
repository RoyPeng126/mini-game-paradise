import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignSeats,
  createMahjongDeck,
  createSetupMahjongGame,
  determineDealerFromDice,
  rollDice,
  startGameAfterDice,
} from '../src/games/mahjong/logic.js'

test('rollDice returns two values between one and six', () => {
  const result = rollDice()
  assert.equal(result.values.length, 2)
  assert.equal(result.values.every((value) => value >= 1 && value <= 6), true)
  assert.equal(result.total, result.values[0] + result.values[1])
})

test('rollDice accepts an injected random function', () => {
  const values = [0, 0.999]
  const result = rollDice(() => values.shift())
  assert.deepEqual(result.values, [1, 6])
  assert.equal(result.total, 7)
})

for (const [total, dealer] of [
  [5, 0],
  [6, 1],
  [7, 2],
  [8, 3],
  [9, 0],
]) {
  test(`determineDealerFromDice maps total ${total} to player ${dealer}`, () => {
    assert.equal(determineDealerFromDice(total), dealer)
  })
}

test('assignSeats makes the dealer East and the next player South', () => {
  const players = Array.from({ length: 4 }, (_, id) => ({ id }))
  const assigned = assignSeats(players, 2)

  assert.equal(assigned[2].seat, 'East')
  assert.equal(assigned[3].seat, 'South')
  assert.equal(assigned[0].seat, 'West')
  assert.equal(assigned[1].seat, 'North')
})

test('createSetupMahjongGame starts in rollingDice setup without dealing', () => {
  const game = createSetupMahjongGame()

  assert.equal(game.status, 'setup')
  assert.equal(game.setupPhase, 'rollingDice')
  assert.equal(game.wall.length, 0)
  assert.equal(game.players.every((player) => player.hand.length === 0), true)
})

test('startGameAfterDice starts play with the selected dealer as East', () => {
  const setup = createSetupMahjongGame()
  setup.dice = { values: [3, 4], total: 7 }
  const game = startGameAfterDice(setup, createMahjongDeck())

  assert.equal(game.status, 'playing')
  assert.equal(game.setupPhase, 'completed')
  assert.equal(game.dealer, 2)
  assert.equal(game.currentPlayer, 2)
  assert.equal(game.players[2].seat, 'East')
  assert.equal(game.players[3].seat, 'South')
})

test('a fresh setup state represents returning to rollingDice for New Game', () => {
  const game = createSetupMahjongGame()
  assert.equal(game.setupPhase, 'rollingDice')
  assert.deepEqual(game.dice.values, [])
})
