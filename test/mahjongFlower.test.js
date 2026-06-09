import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addFlowerToPlayer,
  drawTileSkippingFlowers,
  extractFlowersFromHand,
  getFlowerSeat,
  isFlowerTile,
  isSeatFlower,
  resolveFlowersForPlayer,
} from '../src/games/mahjong/flowerLogic.js'

const tile = (suit, rank, copy = 0) => ({
  id: `${suit}-${rank}-${copy}`,
  suit,
  rank,
  label: `${rank}`,
})

const player = () => ({
  id: 0,
  name: 'You',
  hand: [],
  flowerTiles: [],
})

const game = (hand = [], wall = []) => ({
  status: 'playing',
  message: '',
  wall,
  players: [{ ...player(), hand }],
})

test('isFlowerTile identifies flower tiles only', () => {
  assert.equal(isFlowerTile(tile('flower', 'spring')), true)
  assert.equal(isFlowerTile(tile('characters', 1)), false)
})

for (const [rank, seat] of [
  ['spring', 0],
  ['plum', 0],
  ['summer', 1],
  ['orchid', 1],
  ['autumn', 2],
  ['bamboo', 2],
  ['winter', 3],
  ['chrysanthemum', 3],
]) {
  test(`getFlowerSeat maps ${rank} to seat ${seat}`, () => {
    assert.equal(getFlowerSeat(tile('flower', rank)), seat)
  })
}

test('isSeatFlower accepts a matching seat flower', () => {
  assert.equal(isSeatFlower(tile('flower', 'spring'), 0), true)
})

test('isSeatFlower rejects a non-matching seat flower', () => {
  assert.equal(isSeatFlower(tile('flower', 'summer'), 0), false)
})

test('isSeatFlower follows the player assigned seat instead of player index', () => {
  const gameState = {
    players: [
      { id: 0, seat: 'West' },
      { id: 1, seat: 'North' },
      { id: 2, seat: 'East' },
      { id: 3, seat: 'South' },
    ],
  }

  assert.equal(isSeatFlower(tile('flower', 'spring'), 2, gameState), true)
  assert.equal(isSeatFlower(tile('flower', 'plum'), 2, gameState), true)
  assert.equal(isSeatFlower(tile('flower', 'autumn'), 2, gameState), false)
})

test('addFlowerToPlayer keeps flower tiles outside the hand', () => {
  const result = addFlowerToPlayer(player(), tile('flower', 'plum'))
  assert.equal(result.flowerTiles.length, 1)
  assert.equal(result.hand.length, 0)
})

test('extractFlowersFromHand moves flowers and draws replacements', () => {
  const result = extractFlowersFromHand(
    {
      ...player(),
      hand: [tile('flower', 'spring'), tile('dots', 2)],
    },
    [tile('bamboo', 7)],
  )
  assert.equal(result.player.flowerTiles.length, 1)
  assert.equal(result.player.hand.length, 2)
  assert.equal(result.player.hand.some(isFlowerTile), false)
})

test('resolveFlowersForPlayer handles consecutive replacement flowers', () => {
  const result = resolveFlowersForPlayer(
    game(
      [tile('flower', 'spring')],
      [
        tile('flower', 'plum'),
        tile('flower', 'summer'),
        tile('characters', 4),
      ],
    ),
    0,
  )
  assert.equal(result.players[0].flowerTiles.length, 3)
  assert.equal(result.players[0].hand[0].suit, 'characters')
  assert.equal(result.wall.length, 0)
})

test('drawTileSkippingFlowers replaces flowers until a numbered tile is drawn', () => {
  const result = drawTileSkippingFlowers(
    game([], [
      tile('flower', 'autumn'),
      tile('flower', 'bamboo'),
      tile('dots', 6),
    ]),
    0,
  )
  assert.equal(result.success, true)
  assert.equal(result.tile.suit, 'dots')
  assert.equal(result.gameState.players[0].flowerTiles.length, 2)
  assert.equal(result.gameState.players[0].hand.some(isFlowerTile), false)
})

test('flower replacement ends in draw when the wall is exhausted', () => {
  const result = drawTileSkippingFlowers(
    game([], [tile('flower', 'winter')]),
    0,
  )
  assert.equal(result.success, false)
  assert.equal(result.gameState.status, 'draw')
  assert.equal(result.gameState.players[0].flowerTiles.length, 1)
})
