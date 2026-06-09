import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SCORING_MODES,
  SCORING_RULES,
  SCORING_RULES_TAIWAN_COMMON,
  calculatePayments,
  calculateTai,
  countSeatFlowers,
  detectPatterns,
  getFlowerPatterns,
  getPrevailingWindRank,
  getSeatWindRank,
  getTripletLikeGroups,
  hasNobleSet,
  hasSeasonSet,
  hasTripletOf,
  isDealer,
  isKongDraw,
  isMenqing,
  isRobKong,
  isSelfDraw,
} from '../src/games/mahjong/scoring.js'

const tile = (suit, rank, copy = 0) => ({
  id: `${suit}-${rank}-${copy}`,
  suit,
  rank,
  label: `${rank}`,
})

function createPlayer(id, melds = []) {
  return {
    id,
    name: id === 0 ? 'You' : `Computer ${id}`,
    seat: ['East', 'South', 'West', 'North'][id],
    hand: [],
    flowerTiles: [],
    melds,
  }
}

function createGame(melds = [], dealer = 0) {
  return {
    dealer,
    players: [
      createPlayer(0, melds),
      createPlayer(1),
      createPlayer(2),
      createPlayer(3),
    ],
  }
}

const concealedKong = {
  type: 'kong',
  kongType: 'concealed',
  concealed: true,
  tiles: [
    tile('characters', 3, 0),
    tile('characters', 3, 1),
    tile('characters', 3, 2),
    tile('characters', 3, 3),
  ],
}

const exposedKong = {
  ...concealedKong,
  kongType: 'exposed',
  concealed: false,
}

test('isMenqing returns true without melds', () => {
  assert.equal(isMenqing(createPlayer(0)), true)
})

test('isMenqing remains true with only a concealed kong', () => {
  assert.equal(isMenqing(createPlayer(0, [concealedKong])), true)
})

test('isMenqing returns false with chi', () => {
  assert.equal(isMenqing(createPlayer(0, [{ type: 'chi', tiles: [] }])), false)
})

test('isMenqing returns false with pong', () => {
  assert.equal(isMenqing(createPlayer(0, [{ type: 'pong', tiles: [] }])), false)
})

test('isMenqing returns false with an exposed kong', () => {
  assert.equal(isMenqing(createPlayer(0, [exposedKong])), false)
})

test('win context helpers recognize matching win types', () => {
  assert.equal(isSelfDraw({ type: 'selfDraw' }), true)
  assert.equal(isRobKong({ isRobKong: true }), true)
  assert.equal(isKongDraw({ type: 'kongDraw' }), true)
  assert.equal(isDealer(createGame(), 0), true)
})

test('detectPatterns detects self draw', () => {
  const result = detectPatterns(createGame([{ type: 'chi', tiles: [] }]), 0, {
    type: 'selfDraw',
  })
  assert.equal(result.patterns.some((pattern) => pattern.key === 'selfDraw'), true)
})

test('detectPatterns detects menqing', () => {
  const result = detectPatterns(createGame(), 0, {
    type: 'discard',
    fromPlayer: 1,
  })
  assert.equal(result.patterns.some((pattern) => pattern.key === 'menqing'), true)
})

test('detectPatterns detects menqing self draw', () => {
  const result = detectPatterns(createGame(), 0, { type: 'selfDraw' })
  assert.equal(
    result.patterns.some((pattern) => pattern.key === 'menqingSelfDraw'),
    true,
  )
})

test('detectPatterns detects rob kong', () => {
  const result = detectPatterns(createGame([], 1), 0, { type: 'robKong' })
  assert.equal(result.patterns.some((pattern) => pattern.key === 'robKong'), true)
})

test('detectPatterns detects kong draw', () => {
  const result = detectPatterns(createGame([], 1), 0, { type: 'kongDraw' })
  assert.equal(result.patterns.some((pattern) => pattern.key === 'kongDraw'), true)
})

test('detectPatterns detects dealer win', () => {
  const result = detectPatterns(createGame([], 2), 2, { type: 'discard' })
  assert.equal(result.patterns.some((pattern) => pattern.key === 'dealerWin'), true)
})

test('isDealer follows gameState.dealer after seats are reassigned', () => {
  const game = createGame([], 2)
  assert.equal(isDealer(game, 2), true)
  assert.equal(isDealer(game, 0), false)
})

test('calculateTai returns the summed tai value', () => {
  const result = calculateTai(createGame(), 0, { type: 'selfDraw' })
  assert.equal(
    result.totalTai,
    SCORING_RULES.selfDraw +
      SCORING_RULES.menqing +
      SCORING_RULES.menqingSelfDraw +
      SCORING_RULES.dealerWin,
  )
})

test('calculatePayments charges all opponents for self draw', () => {
  const result = calculatePayments(createGame([], 1), 0, { type: 'selfDraw' })
  const winner = result.payments.find((payment) => payment.playerIndex === 0)
  const opponents = result.payments.filter((payment) => payment.playerIndex !== 0)

  assert.equal(winner.delta, result.points * 3)
  assert.equal(opponents.every((payment) => payment.delta === -result.points), true)
})

test('calculatePayments charges only the discarder for discard win', () => {
  const result = calculatePayments(
    createGame([{ type: 'pong', tiles: [] }], 1),
    0,
    { type: 'discard', fromPlayer: 2 },
  )
  assert.equal(result.payments[2].delta, -(result.points * 3))
  assert.equal(result.payments[0].delta, result.points * 3)
  assert.equal(result.payments[1].delta, 0)
  assert.equal(result.payments[3].delta, 0)
})

test('calculatePayments charges the kong player for rob kong', () => {
  const result = calculatePayments(createGame([], 1), 0, {
    type: 'robKong',
    fromPlayer: 3,
  })
  assert.equal(result.payments[3].delta, -(result.points * 3))
  assert.equal(result.payments[0].delta, result.points * 3)
})

test('calculatePayments treats kong draw as self draw', () => {
  const result = calculatePayments(createGame([], 1), 0, {
    type: 'kongDraw',
    isKongDraw: true,
  })
  assert.equal(result.payments[0].delta, result.points * 3)
  assert.equal(
    result.payments
      .slice(1)
      .every((payment) => payment.delta === -result.points),
    true,
  )
})

test('calculatePayments uses at least one tai', () => {
  const game = createGame([{ type: 'chi', tiles: [] }], 1)
  const result = calculatePayments(game, 0, {
    type: 'discard',
    fromPlayer: 2,
  })
  assert.equal(result.totalTai, 1)
  assert.equal(result.points, 10)
})

test('patterns contain key, name, and tai', () => {
  const { patterns } = detectPatterns(createGame(), 0, { type: 'selfDraw' })
  assert.equal(patterns.length > 0, true)
  assert.equal(
    patterns.every(
      (pattern) =>
        typeof pattern.key === 'string' &&
        typeof pattern.name === 'string' &&
        typeof pattern.tai === 'number',
    ),
    true,
  )
})

for (const rank of ['red', 'green', 'white']) {
  test(`detectPatterns detects ${rank} dragon pong`, () => {
    const game = createGame([], 1)
    game.players[0].hand = [
      tile('dragon', rank, 0),
      tile('dragon', rank, 1),
      tile('dragon', rank, 2),
    ]
    const result = detectPatterns(game, 0, { type: 'discard', fromPlayer: 1 })
    assert.equal(
      result.patterns.some(
        (pattern) => pattern.key === 'dragonPong' && pattern.tai === 1,
      ),
      true,
    )
  })
}

test('dragon kong counts as dragon pong', () => {
  const dragonKong = {
    type: 'kong',
    kongType: 'exposed',
    concealed: false,
    tiles: [
      tile('dragon', 'red', 0),
      tile('dragon', 'red', 1),
      tile('dragon', 'red', 2),
      tile('dragon', 'red', 3),
    ],
  }
  const game = createGame([dragonKong], 1)
  const result = detectPatterns(game, 0, { type: 'discard', fromPlayer: 1 })
  assert.equal(result.patterns.some((pattern) => pattern.key === 'dragonPong'), true)
})

test('seat wind pong scores for the player seat', () => {
  const game = createGame([], 1)
  game.players[0].hand = [
    tile('wind', 'east', 0),
    tile('wind', 'east', 1),
    tile('wind', 'east', 2),
  ]
  assert.equal(getSeatWindRank(0), 'east')
  assert.equal(hasTripletOf(game.players[0], 'wind', 'east'), true)
  const result = detectPatterns(game, 0, { type: 'discard', fromPlayer: 1 })
  assert.equal(
    result.patterns.some((pattern) => pattern.key === 'seatWindPong'),
    true,
  )
})

test('seat wind pong follows the player actual assigned seat', () => {
  const game = createGame([], 2)
  game.players[0].seat = 'West'
  game.players[0].hand = [
    tile('wind', 'west', 0),
    tile('wind', 'west', 1),
    tile('wind', 'west', 2),
  ]

  assert.equal(getSeatWindRank(0, game), 'west')
  const result = detectPatterns(game, 0, { type: 'discard', fromPlayer: 1 })
  assert.equal(
    result.patterns.some((pattern) => pattern.key === 'seatWindPong'),
    true,
  )
})

test('non-seat wind pong does not score seat wind', () => {
  const game = createGame([], 1)
  game.players[0].hand = [
    tile('wind', 'south', 0),
    tile('wind', 'south', 1),
    tile('wind', 'south', 2),
  ]
  const result = detectPatterns(game, 0, { type: 'discard', fromPlayer: 1 })
  assert.equal(
    result.patterns.some((pattern) => pattern.key === 'seatWindPong'),
    false,
  )
})

test('east pong scores prevailing wind', () => {
  const game = createGame([], 1)
  game.players[2].hand = [
    tile('wind', 'east', 0),
    tile('wind', 'east', 1),
    tile('wind', 'east', 2),
  ]
  assert.equal(getPrevailingWindRank(game), 'east')
  const result = detectPatterns(game, 2, { type: 'discard', fromPlayer: 1 })
  assert.equal(
    result.patterns.some((pattern) => pattern.key === 'prevailingWindPong'),
    true,
  )
})

test('wind kong counts as wind pong scoring', () => {
  const windKong = {
    type: 'kong',
    kongType: 'concealed',
    concealed: true,
    tiles: [
      tile('wind', 'east', 0),
      tile('wind', 'east', 1),
      tile('wind', 'east', 2),
      tile('wind', 'east', 3),
    ],
  }
  const game = createGame([windKong], 1)
  const groups = getTripletLikeGroups(game.players[0])
  assert.equal(groups.some((group) => group.suit === 'wind'), true)
  const result = detectPatterns(game, 0, { type: 'discard', fromPlayer: 1 })
  assert.equal(
    result.patterns.some((pattern) => pattern.key === 'seatWindPong'),
    true,
  )
  assert.equal(
    result.patterns.some((pattern) => pattern.key === 'prevailingWindPong'),
    true,
  )
})

test('calculateTai adds dragon pong to existing patterns', () => {
  const game = createGame([], 0)
  game.players[0].hand = [
    tile('dragon', 'green', 0),
    tile('dragon', 'green', 1),
    tile('dragon', 'green', 2),
  ]
  const result = calculateTai(game, 0, { type: 'selfDraw' })
  assert.equal(result.patterns.some((pattern) => pattern.key === 'dragonPong'), true)
  assert.equal(
    result.totalTai,
    SCORING_RULES.selfDraw +
      SCORING_RULES.menqing +
      SCORING_RULES.menqingSelfDraw +
      SCORING_RULES.dealerWin +
      SCORING_RULES.dragonPong,
  )
})

test('calculatePayments includes honor tai without breaking payment balance', () => {
  const game = createGame([], 1)
  game.players[0].hand = [
    tile('dragon', 'white', 0),
    tile('dragon', 'white', 1),
    tile('dragon', 'white', 2),
  ]
  const result = calculatePayments(game, 0, {
    type: 'discard',
    fromPlayer: 2,
  })
  assert.equal(result.payments.reduce((sum, payment) => sum + payment.delta, 0), 0)
  assert.equal(result.payments[2].delta, -(result.points * 3))
})

test('detectPatterns scores one tai per flower tile', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [
    tile('flower', 'summer'),
    tile('flower', 'winter'),
  ]
  const result = detectPatterns(game, 0, { type: 'discard', fromPlayer: 1 })
  const pattern = result.patterns.find((item) => item.key === 'flower')
  assert.equal(pattern.tai, 2)
})

test('seat flower scoring follows reassigned East seat', () => {
  const game = createGame([], 2)
  game.players[0].seat = 'West'
  game.players[1].seat = 'North'
  game.players[2].seat = 'East'
  game.players[3].seat = 'South'
  game.players[2].flowerTiles = [
    tile('flower', 'spring'),
    tile('flower', 'plum'),
  ]

  const result = detectPatterns(game, 2, { type: 'discard', fromPlayer: 1 })
  const seatFlower = result.patterns.find(
    (pattern) => pattern.key === 'seatFlower',
  )
  assert.equal(seatFlower.tai, 2)
})

for (const [playerIndex, ranks] of [
  [0, ['spring', 'plum']],
  [1, ['summer', 'orchid']],
  [2, ['autumn', 'bamboo']],
  [3, ['winter', 'chrysanthemum']],
]) {
  for (const rank of ranks) {
    test(`${rank} scores as a seat flower for player ${playerIndex}`, () => {
      const game = createGame([], 3)
      game.players[playerIndex].flowerTiles = [tile('flower', rank)]
      const result = detectPatterns(game, playerIndex, {
        type: 'discard',
        fromPlayer: (playerIndex + 1) % 4,
      })
      assert.equal(
        result.patterns.some(
          (pattern) => pattern.key === 'seatFlower' && pattern.tai === 1,
        ),
        true,
      )
    })
  }
}

test('detectPatterns scores all flowers when one player has all eight', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [
    'spring',
    'summer',
    'autumn',
    'winter',
    'plum',
    'orchid',
    'bamboo',
    'chrysanthemum',
  ].map((rank) => tile('flower', rank))
  const result = detectPatterns(game, 0, { type: 'discard', fromPlayer: 1 })
  assert.equal(
    result.patterns.some(
      (pattern) =>
        pattern.key === 'allFlowers' &&
        pattern.tai === SCORING_RULES.allFlowers,
    ),
    true,
  )
})

test('calculateTai adds flower and seat flower to existing patterns', () => {
  const game = createGame([], 0)
  game.players[0].flowerTiles = [tile('flower', 'spring')]
  const result = calculateTai(game, 0, { type: 'selfDraw' })
  assert.equal(result.patterns.some((pattern) => pattern.key === 'flower'), true)
  assert.equal(result.patterns.some((pattern) => pattern.key === 'seatFlower'), true)
  assert.equal(
    result.totalTai,
    SCORING_RULES.selfDraw +
      SCORING_RULES.menqing +
      SCORING_RULES.menqingSelfDraw +
      SCORING_RULES.dealerWin +
      SCORING_RULES.flower +
      SCORING_RULES.seatFlower,
  )
})

test('calculatePayments stays balanced with flower patterns', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [tile('flower', 'summer')]
  const result = calculatePayments(game, 0, {
    type: 'discard',
    fromPlayer: 2,
  })
  assert.equal(result.payments.reduce((sum, payment) => sum + payment.delta, 0), 0)
  assert.equal(result.payments[2].delta, -(result.points * 3))
})

test('taiwanCommon does not award one tai for every flower tile', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [
    tile('flower', 'summer'),
    tile('flower', 'winter'),
  ]
  const result = detectPatterns(
    game,
    0,
    { type: 'discard', fromPlayer: 1 },
    SCORING_MODES.TAIWAN_COMMON,
  )

  assert.equal(result.patterns.some((pattern) => pattern.key === 'flower'), false)
  assert.equal(result.patterns.some((pattern) => pattern.key === 'seatFlower'), false)
})

test('taiwanCommon awards one tai for a matching seat flower', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [tile('flower', 'spring')]
  const patterns = getFlowerPatterns(
    game.players[0],
    game,
    SCORING_MODES.TAIWAN_COMMON,
  )

  assert.equal(countSeatFlowers(game.players[0], game), 1)
  assert.equal(
    patterns.some(
      (pattern) => pattern.key === 'seatFlower' && pattern.tai === 1,
    ),
    true,
  )
})

test('taiwanCommon awards seasonSet for spring summer autumn winter', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [
    'spring',
    'summer',
    'autumn',
    'winter',
  ].map((rank) => tile('flower', rank))
  const patterns = getFlowerPatterns(
    game.players[0],
    game,
    SCORING_MODES.TAIWAN_COMMON,
  )

  assert.equal(hasSeasonSet(game.players[0]), true)
  assert.equal(
    patterns.some(
      (pattern) =>
        pattern.key === 'seasonSet' &&
        pattern.name === 'Season Flower Set' &&
        pattern.tai === SCORING_RULES_TAIWAN_COMMON.seasonSet,
    ),
    true,
  )
})

test('taiwanCommon awards nobleSet for plum orchid bamboo chrysanthemum', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [
    'plum',
    'orchid',
    'bamboo',
    'chrysanthemum',
  ].map((rank) => tile('flower', rank))
  const patterns = getFlowerPatterns(
    game.players[0],
    game,
    SCORING_MODES.TAIWAN_COMMON,
  )

  assert.equal(hasNobleSet(game.players[0]), true)
  assert.equal(
    patterns.some(
      (pattern) =>
        pattern.key === 'nobleSet' &&
        pattern.name === 'Noble Flower Set' &&
        pattern.tai === SCORING_RULES_TAIWAN_COMMON.nobleSet,
    ),
    true,
  )
})

test('taiwanCommon awards allFlowers together with both flower sets', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [
    'spring',
    'summer',
    'autumn',
    'winter',
    'plum',
    'orchid',
    'bamboo',
    'chrysanthemum',
  ].map((rank) => tile('flower', rank))
  const patterns = getFlowerPatterns(
    game.players[0],
    game,
    SCORING_MODES.TAIWAN_COMMON,
  )

  assert.equal(patterns.some((pattern) => pattern.key === 'seasonSet'), true)
  assert.equal(patterns.some((pattern) => pattern.key === 'nobleSet'), true)
  assert.equal(
    patterns.some(
      (pattern) =>
        pattern.key === 'allFlowers' &&
        pattern.tai === SCORING_RULES_TAIWAN_COMMON.allFlowers,
    ),
    true,
  )
})

test('taiwanCommon can stack seatFlower with seasonSet', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [
    'spring',
    'summer',
    'autumn',
    'winter',
  ].map((rank) => tile('flower', rank))
  const patterns = getFlowerPatterns(
    game.players[0],
    game,
    SCORING_MODES.TAIWAN_COMMON,
  )

  assert.equal(patterns.some((pattern) => pattern.key === 'seatFlower'), true)
  assert.equal(patterns.some((pattern) => pattern.key === 'seasonSet'), true)
})

test('taiwanCommon can stack seatFlower with nobleSet', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [
    'plum',
    'orchid',
    'bamboo',
    'chrysanthemum',
  ].map((rank) => tile('flower', rank))
  const patterns = getFlowerPatterns(
    game.players[0],
    game,
    SCORING_MODES.TAIWAN_COMMON,
  )

  assert.equal(patterns.some((pattern) => pattern.key === 'seatFlower'), true)
  assert.equal(patterns.some((pattern) => pattern.key === 'nobleSet'), true)
})

test('simple mode still awards one tai per flower tile', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [
    tile('flower', 'summer'),
    tile('flower', 'winter'),
  ]
  const result = detectPatterns(
    game,
    0,
    { type: 'discard', fromPlayer: 1 },
    SCORING_MODES.SIMPLE,
  )
  const flowerPattern = result.patterns.find(
    (pattern) => pattern.key === 'flower',
  )

  assert.equal(flowerPattern.tai, 2)
  assert.equal(result.mode, SCORING_MODES.SIMPLE)
})

test('calculateTai accepts taiwanCommon mode', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [
    'spring',
    'summer',
    'autumn',
    'winter',
  ].map((rank) => tile('flower', rank))
  const result = calculateTai(
    game,
    0,
    { type: 'discard', fromPlayer: 1 },
    SCORING_MODES.TAIWAN_COMMON,
  )

  assert.equal(result.mode, SCORING_MODES.TAIWAN_COMMON)
  assert.equal(result.patterns.some((pattern) => pattern.key === 'seasonSet'), true)
})

test('calculatePayments includes the selected scoring mode', () => {
  const game = createGame([], 1)
  game.players[0].flowerTiles = [tile('flower', 'spring')]
  const result = calculatePayments(
    game,
    0,
    { type: 'discard', fromPlayer: 2 },
    SCORING_MODES.TAIWAN_COMMON,
  )

  assert.equal(result.mode, SCORING_MODES.TAIWAN_COMMON)
  assert.equal(
    result.patterns.some(
      (pattern) =>
        pattern.key === 'seatFlower' && pattern.name === 'Seat Flowers',
    ),
    true,
  )
  assert.equal(result.payments.reduce((sum, payment) => sum + payment.delta, 0), 0)
})

test('both scoring modes expose the simplified hand pattern values', () => {
  for (const mode of [SCORING_MODES.SIMPLE, SCORING_MODES.TAIWAN_COMMON]) {
    const game = createGame([], 1)
    game.players[0].hand = [
      tile('characters', 1, 0),
      tile('characters', 2, 0),
      tile('characters', 3, 0),
      tile('characters', 1, 1),
      tile('characters', 2, 1),
      tile('characters', 3, 1),
      tile('characters', 4, 0),
      tile('characters', 5, 0),
      tile('characters', 6, 0),
      tile('characters', 4, 1),
      tile('characters', 5, 1),
      tile('characters', 6, 1),
      tile('characters', 7, 0),
      tile('characters', 8, 0),
      tile('characters', 9, 0),
      tile('characters', 9, 1),
      tile('characters', 9, 2),
    ]
    const result = detectPatterns(
      game,
      0,
      { type: 'discard', fromPlayer: 1 },
      mode,
    )
    assert.equal(result.patterns.some((pattern) => pattern.key === 'pinfu'), true)
    assert.equal(
      result.patterns.some(
        (pattern) => pattern.key === 'fullFlush' && pattern.tai === 8,
      ),
      true,
    )
  }
})
