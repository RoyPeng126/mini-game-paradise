import assert from 'node:assert/strict'
import test from 'node:test'
import {
  detectBasicPatterns,
  isAllPongs,
  isPinfu,
} from '../src/games/mahjong/patterns/basicPatterns.js'
import {
  getAllTilesForPattern,
  getHandTiles,
  getMeldTiles,
  getSequenceGroupsFromMelds,
  getSuitSummary,
  getTripletGroupsFromMelds,
  groupTilesByKey,
  isDragonTile,
  isHonorTile,
  isNumberSuit,
  isWindTile,
} from '../src/games/mahjong/patterns/patternUtils.js'
import {
  detectSuitPatterns,
  isFullFlush,
  isHalfFlush,
} from '../src/games/mahjong/patterns/suitPatterns.js'
import {
  SCORING_MODES,
  calculatePayments,
  calculateTai,
  detectPatterns,
} from '../src/games/mahjong/scoring.js'

const tile = (suit, rank, copy = 0) => ({
  id: `${suit}-${rank}-${copy}`,
  suit,
  rank,
  label: `${rank}`,
})

const triplet = (suit, rank, offset = 0) =>
  Array.from({ length: 3 }, (_, index) => tile(suit, rank, offset + index))

const sequence = (suit, startRank, offset = 0) => [
  tile(suit, startRank, offset),
  tile(suit, startRank + 1, offset),
  tile(suit, startRank + 2, offset),
]

const pair = (suit, rank, offset = 0) => [
  tile(suit, rank, offset),
  tile(suit, rank, offset + 1),
]

const meld = (type, tiles, extra = {}) => ({
  type,
  tiles,
  fromPlayer: 1,
  concealed: false,
  ...extra,
})

function player(hand = [], melds = [], flowerTiles = []) {
  return {
    id: 0,
    name: 'You',
    seat: 'East',
    hand,
    melds,
    flowerTiles,
  }
}

function gameWithPlayer(winner) {
  return {
    dealer: 1,
    prevailingWind: 'east',
    players: [
      winner,
      { ...player(), id: 1, name: 'Computer 1', seat: 'South' },
      { ...player(), id: 2, name: 'Computer 2', seat: 'West' },
      { ...player(), id: 3, name: 'Computer 3', seat: 'North' },
    ],
  }
}

function allPongsHand() {
  return [
    ...triplet('characters', 1),
    ...triplet('characters', 3),
    ...triplet('dots', 2),
    ...triplet('bamboo', 6),
    ...triplet('wind', 'east'),
    ...pair('dragon', 'white'),
  ]
}

function pinfuHand() {
  return [
    ...sequence('characters', 1),
    ...sequence('characters', 4),
    ...sequence('dots', 2),
    ...sequence('dots', 6),
    ...sequence('bamboo', 3),
    ...pair('wind', 'north'),
  ]
}

test('isAllPongs accepts triplets and a pair without chi', () => {
  assert.equal(isAllPongs(player(allPongsHand())), true)
})

test('isAllPongs rejects a player with a chi meld', () => {
  const hand = [
    ...triplet('characters', 1),
    ...triplet('dots', 2),
    ...triplet('bamboo', 6),
    ...triplet('wind', 'east'),
    ...pair('dragon', 'white'),
  ]
  assert.equal(
    isAllPongs(player(hand, [meld('chi', sequence('characters', 4))])),
    false,
  )
})

test('isAllPongs accepts a kong as a triplet-like meld', () => {
  const hand = [
    ...triplet('characters', 1),
    ...triplet('dots', 2),
    ...triplet('bamboo', 6),
    ...triplet('wind', 'east'),
    ...pair('dragon', 'white'),
  ]
  const kong = meld(
    'kong',
    [...triplet('characters', 9), tile('characters', 9, 3)],
    { kongType: 'concealed', concealed: true },
  )
  assert.equal(isAllPongs(player(hand, [kong])), true)
})

test('isAllPongs accepts honor triplets', () => {
  assert.equal(isAllPongs(player(allPongsHand())), true)
})

test('isPinfu accepts sequences and a pair', () => {
  assert.equal(isPinfu(player(pinfuHand())), true)
})

test('isPinfu rejects a pong meld', () => {
  assert.equal(
    isPinfu(player(pinfuHand().slice(3), [meld('pong', triplet('characters', 1))])),
    false,
  )
})

test('isPinfu rejects a kong meld', () => {
  const kong = meld(
    'kong',
    [...triplet('characters', 1), tile('characters', 1, 3)],
    { kongType: 'exposed' },
  )
  assert.equal(isPinfu(player(pinfuHand().slice(3), [kong])), false)
})

test('isPinfu rejects a concealed triplet', () => {
  const hand = pinfuHand()
  hand.splice(0, 3, ...triplet('characters', 1))
  assert.equal(isPinfu(player(hand)), false)
})

test('isPinfu accepts a chi meld with remaining sequences and pair', () => {
  assert.equal(
    isPinfu(
      player(
        pinfuHand().slice(3),
        [meld('chi', sequence('characters', 1))],
      ),
    ),
    true,
  )
})

for (const suit of ['characters', 'dots', 'bamboo']) {
  test(`isFullFlush accepts an all-${suit} hand`, () => {
    assert.equal(
      isFullFlush(player([
        ...sequence(suit, 1),
        ...triplet(suit, 5),
        ...pair(suit, 9),
      ])),
      true,
    )
  })
}

test('isFullFlush rejects one numbered suit with an honor tile', () => {
  assert.equal(
    isFullFlush(player([
      ...sequence('characters', 1),
      tile('wind', 'east'),
    ])),
    false,
  )
})

test('isHalfFlush accepts characters with a wind tile', () => {
  assert.equal(
    isHalfFlush(player([
      ...sequence('characters', 1),
      tile('wind', 'east'),
    ])),
    true,
  )
})

test('isHalfFlush accepts one suit with dragon tiles', () => {
  assert.equal(
    isHalfFlush(player([
      ...sequence('characters', 1),
      tile('dragon', 'red'),
      tile('dragon', 'green'),
      tile('dragon', 'white'),
    ])),
    true,
  )
})

test('isHalfFlush rejects multiple numbered suits', () => {
  assert.equal(
    isHalfFlush(player([
      ...sequence('characters', 1),
      ...sequence('dots', 1),
      tile('wind', 'east'),
    ])),
    false,
  )
})

test('one numbered suit without honors is fullFlush rather than halfFlush', () => {
  const winner = player([...sequence('characters', 1), ...pair('characters', 9)])
  assert.equal(isFullFlush(winner), true)
  assert.equal(isHalfFlush(winner), false)
})

test('detectSuitPatterns never returns fullFlush and halfFlush together', () => {
  const game = gameWithPlayer(
    player([...sequence('characters', 1), ...pair('characters', 9)]),
  )
  const patterns = detectSuitPatterns(game, 0, {}, SCORING_MODES.SIMPLE)
  assert.deepEqual(patterns.map((pattern) => pattern.key), ['fullFlush'])
})

test('pattern utilities include hand and meld tiles but exclude flowers', () => {
  const winner = player(
    [tile('characters', 1), tile('flower', 'spring')],
    [
      meld('chi', sequence('characters', 2)),
      meld('pong', triplet('dragon', 'red')),
    ],
    [tile('flower', 'plum')],
  )

  assert.equal(getHandTiles(winner).length, 1)
  assert.equal(getMeldTiles(winner).length, 6)
  assert.equal(getAllTilesForPattern(winner).length, 7)
  assert.equal(getSequenceGroupsFromMelds(winner).length, 1)
  assert.equal(getTripletGroupsFromMelds(winner).length, 1)
  assert.equal(groupTilesByKey(getAllTilesForPattern(winner)).size, 5)
  assert.equal(isNumberSuit(tile('characters', 1)), true)
  assert.equal(isHonorTile(tile('wind', 'east')), true)
  assert.equal(isWindTile(tile('wind', 'east')), true)
  assert.equal(isDragonTile(tile('dragon', 'red')), true)
  assert.equal(getSuitSummary(winner).hasHonors, true)
})

test('detectPatterns adds pinfu', () => {
  const result = detectPatterns(
    gameWithPlayer(player(pinfuHand())),
    0,
    { type: 'discard', fromPlayer: 1 },
  )
  assert.equal(result.patterns.some((pattern) => pattern.key === 'pinfu'), true)
})

test('detectPatterns adds allPongs', () => {
  const result = detectPatterns(
    gameWithPlayer(player(allPongsHand())),
    0,
    { type: 'discard', fromPlayer: 1 },
  )
  assert.equal(result.patterns.some((pattern) => pattern.key === 'allPongs'), true)
})

test('detectPatterns adds fullFlush', () => {
  const hand = [
    ...sequence('characters', 1),
    ...sequence('characters', 1, 1),
    ...sequence('characters', 4),
    ...sequence('characters', 4, 1),
    ...sequence('characters', 7),
    ...pair('characters', 9),
  ]
  const result = detectPatterns(
    gameWithPlayer(player(hand)),
    0,
    { type: 'discard', fromPlayer: 1 },
  )
  assert.equal(result.patterns.some((pattern) => pattern.key === 'fullFlush'), true)
})

test('detectPatterns adds halfFlush', () => {
  const hand = [
    ...sequence('characters', 1),
    ...sequence('characters', 1, 1),
    ...sequence('characters', 4),
    ...triplet('wind', 'east'),
    ...triplet('dragon', 'red'),
    ...pair('characters', 9),
  ]
  const result = detectPatterns(
    gameWithPlayer(player(hand)),
    0,
    { type: 'discard', fromPlayer: 1 },
  )
  assert.equal(result.patterns.some((pattern) => pattern.key === 'halfFlush'), true)
})

test('calculateTai sums allPongs with dragonPong', () => {
  const result = calculateTai(
    gameWithPlayer(player(allPongsHand())),
    0,
    { type: 'discard', fromPlayer: 1 },
    SCORING_MODES.TAIWAN_COMMON,
  )
  assert.equal(result.patterns.some((pattern) => pattern.key === 'allPongs'), true)
  assert.equal(result.patterns.some((pattern) => pattern.key === 'dragonPong'), false)

  const dragonPongHand = [
    ...triplet('characters', 1),
    ...triplet('characters', 3),
    ...triplet('dots', 2),
    ...triplet('bamboo', 6),
    ...triplet('dragon', 'red'),
    ...pair('wind', 'north'),
  ]
  const dragonResult = calculateTai(
    gameWithPlayer(player(dragonPongHand)),
    0,
    { type: 'discard', fromPlayer: 1 },
  )
  assert.equal(
    dragonResult.patterns.some((pattern) => pattern.key === 'allPongs'),
    true,
  )
  assert.equal(
    dragonResult.patterns.some((pattern) => pattern.key === 'dragonPong'),
    true,
  )
  assert.equal(
    dragonResult.totalTai,
    dragonResult.patterns.reduce((total, pattern) => total + pattern.tai, 0),
  )
})

test('calculatePayments remains balanced with new hand patterns', () => {
  const result = calculatePayments(
    gameWithPlayer(player(allPongsHand())),
    0,
    { type: 'discard', fromPlayer: 2 },
    SCORING_MODES.TAIWAN_COMMON,
  )
  assert.equal(result.payments.reduce((sum, payment) => sum + payment.delta, 0), 0)
  assert.equal(result.patterns.some((pattern) => pattern.key === 'allPongs'), true)
})

test('detectBasicPatterns supports both scoring modes', () => {
  const game = gameWithPlayer(player(allPongsHand()))
  for (const mode of Object.values(SCORING_MODES)) {
    assert.equal(
      detectBasicPatterns(game, 0, {}, mode).some(
        (pattern) => pattern.key === 'allPongs' && pattern.tai === 4,
      ),
      true,
    )
  }
})
