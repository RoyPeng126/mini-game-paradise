import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAHJONG_SUITS,
  NUMBERED_SUITS,
  autoComputerClaim,
  calculateMahjongScore,
  canClaimWin,
  canRobKong,
  canChi,
  canConcealedKong,
  canKong,
  canPong,
  canWin,
  canWinWithMelds,
  claimDiscard,
  claimWin,
  countCompletedMelds,
  createInitialMahjongGame,
  createMahjongDeck,
  declareAddedKong,
  declareConcealedKong,
  declareWin,
  discardTile,
  drawAfterKong,
  drawTile,
  enterClaimPhase,
  getAvailableAddedKongs,
  getAvailableClaims,
  getAvailableConcealedKongs,
  getChiOptions,
  getNextPlayerIndex,
  getTileKey,
  isValidMeld,
  passClaim,
  passRobKong,
  robKongWin,
  runComputerTurn,
  sortHand,
} from '../src/games/mahjong/logic.js'

const tile = (suit, rank, copy = 0) => ({
  id: `${suit}-${rank}-${copy}`,
  suit,
  rank,
  label: `${rank}`,
})

function winningHand() {
  return [
    tile('characters', 1, 0),
    tile('characters', 1, 1),
    tile('characters', 1, 2),
    tile('characters', 2, 0),
    tile('characters', 3, 0),
    tile('characters', 4, 0),
    tile('dots', 2, 0),
    tile('dots', 3, 0),
    tile('dots', 4, 0),
    tile('dots', 7, 0),
    tile('dots', 7, 1),
    tile('dots', 7, 2),
    tile('bamboo', 5, 0),
    tile('bamboo', 6, 0),
    tile('bamboo', 7, 0),
    tile('bamboo', 9, 0),
    tile('bamboo', 9, 1),
  ]
}

function winningSets() {
  return [
    [
      tile('characters', 1, 0),
      tile('characters', 1, 1),
      tile('characters', 1, 2),
    ],
    [
      tile('characters', 2, 0),
      tile('characters', 3, 0),
      tile('characters', 4, 0),
    ],
    [
      tile('dots', 2, 0),
      tile('dots', 3, 0),
      tile('dots', 4, 0),
    ],
    [
      tile('dots', 7, 0),
      tile('dots', 7, 1),
      tile('dots', 7, 2),
    ],
    [
      tile('bamboo', 5, 0),
      tile('bamboo', 6, 0),
      tile('bamboo', 7, 0),
    ],
  ]
}

function winningPair() {
  return [tile('bamboo', 9, 0), tile('bamboo', 9, 1)]
}

function meldFromSet(tiles) {
  const isPong = tiles.every(
    (setTile) =>
      setTile.suit === tiles[0].suit &&
      setTile.rank === tiles[0].rank,
  )
  return {
    type: isPong ? 'pong' : 'chi',
    kongType: null,
    tiles,
    fromPlayer: 1,
    concealed: false,
  }
}

function winningStateWithMeldCount(meldCount) {
  const sets = winningSets()
  return {
    hand: [...sets.slice(meldCount).flat(), ...winningPair()],
    melds: sets.slice(0, meldCount).map(meldFromSet),
  }
}

function repeatedHand(suit, rank, count = 16, copyOffset = 0) {
  return Array.from({ length: count }, (_, index) =>
    tile(suit, rank, copyOffset + index),
  )
}

function claimTestGame({
  discardedTile = tile('characters', 5, 99),
  claimantIndex = 1,
  claimantHand = [],
} = {}) {
  const game = createInitialMahjongGame(createMahjongDeck())
  game.currentPlayer = 0
  game.phase = 'waitingDiscard'
  game.players[0].hand = [
    ...repeatedHand('dots', 9, 16),
    discardedTile,
  ]
  game.players[1].hand = repeatedHand('dots', 9)
  game.players[2].hand = repeatedHand('bamboo', 9)
  game.players[3].hand = repeatedHand('dots', 1)
  game.players[claimantIndex].hand = claimantHand
  game.players.forEach((player) => {
    player.discardPile = []
    player.melds = []
  })
  return game
}

function discardForClaim(game) {
  return discardTile(game, 0, game.players[0].hand.length - 1).gameState
}

function discardWinGame({
  winnerIndex = 0,
  discardedBy = 3,
  additionalHands = {},
} = {}) {
  const game = createInitialMahjongGame(createMahjongDeck())
  const completeHand = winningHand()
  const winningTileIndex = completeHand.findIndex(
    (handTile) => handTile.suit === 'dots' && handTile.rank === 7,
  )
  const [winningTile] = completeHand.splice(winningTileIndex, 1)

  game.currentPlayer = discardedBy
  game.phase = 'waitingDiscard'
  game.players.forEach((player) => {
    player.hand = []
    player.discardPile = []
    player.melds = []
  })
  game.players[winnerIndex].hand = completeHand
  for (const [playerIndex, hand] of Object.entries(additionalHands)) {
    game.players[Number(playerIndex)].hand = hand
  }
  game.players[discardedBy].hand = [
    ...repeatedHand('characters', 9, 16),
    { ...winningTile, id: `${winningTile.id}-discard` },
  ]

  return discardTile(
    game,
    discardedBy,
    game.players[discardedBy].hand.length - 1,
  ).gameState
}

function kongTurnGame() {
  const game = createInitialMahjongGame(createMahjongDeck())
  game.currentPlayer = 0
  game.phase = 'waitingDiscard'
  game.players.forEach((player) => {
    player.hand = []
    player.discardPile = []
    player.melds = []
  })
  game.wall = [tile('dots', 8, 88), tile('bamboo', 4, 89)]
  return game
}

function pongMeld(suit, rank) {
  return {
    type: 'pong',
    kongType: null,
    tiles: [
      tile(suit, rank, 0),
      tile(suit, rank, 1),
      tile(suit, rank, 2),
    ],
    fromPlayer: 2,
    concealed: false,
  }
}

test('createMahjongDeck creates 144 tiles', () => {
  assert.equal(createMahjongDeck().length, 144)
})

test('every suit and rank has four copies', () => {
  const deck = createMahjongDeck()

  for (const suit of NUMBERED_SUITS) {
    for (let rank = 1; rank <= 9; rank += 1) {
      assert.equal(
        deck.filter((deckTile) => deckTile.suit === suit && deckTile.rank === rank).length,
        4,
      )
    }
  }
})

test('every wind rank has four copies', () => {
  const deck = createMahjongDeck()
  for (const rank of ['east', 'south', 'west', 'north']) {
    assert.equal(
      deck.filter((deckTile) => deckTile.suit === 'wind' && deckTile.rank === rank).length,
      4,
    )
  }
})

test('every dragon rank has four copies', () => {
  const deck = createMahjongDeck()
  for (const rank of ['red', 'green', 'white']) {
    assert.equal(
      deck.filter((deckTile) => deckTile.suit === 'dragon' && deckTile.rank === rank).length,
      4,
    )
  }
})

test('the deck contains eight unique flower tiles', () => {
  const flowers = createMahjongDeck().filter((deckTile) => deckTile.suit === 'flower')
  assert.equal(flowers.length, 8)
  assert.equal(new Set(flowers.map((flower) => flower.rank)).size, 8)
  assert.equal(flowers.every((flower) => flower.id.endsWith('-0')), true)
})

test('initial game creates four players', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  assert.equal(game.players.length, 4)
  assert.equal(game.players.every((player) => Array.isArray(player.flowerTiles)), true)
})

test('all four players start with sixteen tiles', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  assert.deepEqual(game.players.map((player) => player.hand.length), [16, 16, 16, 16])
})

test('initial wall contains 80 tiles when the initial deal has no flowers', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  assert.equal(game.wall.length, 80)
})

test('initial flower resolution keeps flowers out of player hands', () => {
  const deck = createMahjongDeck()
  const flower = deck.find((deckTile) => deckTile.suit === 'flower')
  const withoutFlower = deck.filter((deckTile) => deckTile.id !== flower.id)
  const arrangedDeck = [flower, ...withoutFlower]
  const game = createInitialMahjongGame(arrangedDeck)

  assert.equal(game.players.every((player) => player.hand.every((handTile) => handTile.suit !== 'flower')), true)
  assert.equal(game.players[0].flowerTiles.length, 1)
  assert.equal(game.players[0].hand.length, 16)
})

test('sortHand places honors after numbered suits in honor rank order', () => {
  const sorted = sortHand([
    tile('dragon', 'white'),
    tile('wind', 'north'),
    tile('dots', 2),
    tile('characters', 9),
    tile('dragon', 'red'),
    tile('wind', 'east'),
    tile('bamboo', 1),
  ])
  assert.deepEqual(
    sorted.map((sortedTile) => getTileKey(sortedTile)),
    [
      'characters-9',
      'dots-2',
      'bamboo-1',
      'wind-east',
      'wind-north',
      'dragon-red',
      'dragon-white',
    ],
  )
})

test('getTileKey supports winds and dragons', () => {
  assert.equal(getTileKey(tile('wind', 'east')), 'wind-east')
  assert.equal(getTileKey(tile('dragon', 'red')), 'dragon-red')
})

test('player zero starts the game', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  assert.equal(game.currentPlayer, 0)
})

test('drawTile gives current player a seventeenth tile', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  const result = drawTile(game)

  assert.equal(result.success, true)
  assert.equal(result.gameState.players[0].hand.length, 17)
  assert.equal(game.players[0].hand.length, 16)
})

test('drawTile changes the phase to waitingDiscard', () => {
  const result = drawTile(createInitialMahjongGame(createMahjongDeck()))
  assert.equal(result.gameState.phase, 'waitingDiscard')
})

test('discardTile returns the player hand to sixteen tiles', () => {
  const drawn = drawTile(createInitialMahjongGame(createMahjongDeck())).gameState
  const result = discardTile(drawn, 0, 0)

  assert.equal(result.success, true)
  assert.equal(result.gameState.players[0].hand.length, 16)
})

test('discardTile adds the selected tile to the discard pile', () => {
  const drawn = drawTile(createInitialMahjongGame(createMahjongDeck())).gameState
  const discardedTile = drawn.players[0].hand[0]
  const result = discardTile(drawn, 0, 0)

  assert.equal(result.gameState.players[0].discardPile.length, 1)
  assert.equal(result.gameState.players[0].discardPile[0].id, discardedTile.id)
})

test('discardTile advances to the next player', () => {
  const game = claimTestGame()
  const result = discardForClaim(game)
  assert.equal(result.currentPlayer, 1)
  assert.equal(result.phase, 'waitingDraw')
})

test('getNextPlayerIndex cycles through all four players', () => {
  assert.equal(getNextPlayerIndex(0), 1)
  assert.equal(getNextPlayerIndex(1), 2)
  assert.equal(getNextPlayerIndex(2), 3)
  assert.equal(getNextPlayerIndex(3), 0)
})

test('canWin accepts a valid seventeen-tile hand', () => {
  assert.equal(canWin(winningHand()), true)
})

test('canWin rejects an invalid hand', () => {
  const invalidHand = winningHand()
  invalidHand[16] = tile('characters', 8, 0)
  assert.equal(canWin(invalidHand), false)
})

test('honor triplet can form a winning meld', () => {
  const hand = [
    ...winningSets().slice(0, 4).flat(),
    tile('wind', 'east', 0),
    tile('wind', 'east', 1),
    tile('wind', 'east', 2),
    tile('dragon', 'white', 0),
    tile('dragon', 'white', 1),
  ]
  assert.equal(canWin(hand), true)
})

test('honor pair can be the winning pair', () => {
  const hand = [
    ...winningSets().flat(),
    tile('dragon', 'white', 0),
    tile('dragon', 'white', 1),
  ]
  assert.equal(canWin(hand), true)
})

test('different honor tiles cannot form a sequence', () => {
  const hand = [
    ...winningSets().slice(0, 4).flat(),
    tile('wind', 'east'),
    tile('wind', 'south'),
    tile('wind', 'west'),
    tile('dragon', 'white', 0),
    tile('dragon', 'white', 1),
  ]
  assert.equal(canWin(hand), false)
})

test('canWinWithMelds supports an exposed honor pong', () => {
  const honorPong = {
    type: 'pong',
    kongType: null,
    tiles: [
      tile('dragon', 'red', 0),
      tile('dragon', 'red', 1),
      tile('dragon', 'red', 2),
    ],
    fromPlayer: 1,
    concealed: false,
  }
  const hand = [...winningSets().slice(1).flat(), ...winningPair()]
  assert.equal(canWinWithMelds(hand, [honorPong]), true)
})

test('canWinWithMelds supports a concealed five-set winning hand', () => {
  assert.equal(canWinWithMelds(winningHand(), []), true)
})

for (let meldCount = 1; meldCount <= 5; meldCount += 1) {
  test(`canWinWithMelds requires ${5 - meldCount} concealed sets with ${meldCount} melds`, () => {
    const { hand, melds } = winningStateWithMeldCount(meldCount)
    assert.equal(hand.length, (5 - meldCount) * 3 + 2)
    assert.equal(canWinWithMelds(hand, melds), true)
  })
}

test('a valid kong counts as one completed meld', () => {
  const kong = {
    type: 'kong',
    kongType: 'exposed',
    tiles: [
      tile('characters', 6, 0),
      tile('characters', 6, 1),
      tile('characters', 6, 2),
      tile('characters', 6, 3),
    ],
    fromPlayer: 1,
    concealed: false,
  }
  assert.equal(countCompletedMelds([kong]), 1)
})

test('invalid melds do not count as completed melds', () => {
  const invalidMeld = {
    type: 'chi',
    tiles: [
      tile('characters', 2),
      tile('characters', 4),
      tile('characters', 5),
    ],
  }
  assert.equal(countCompletedMelds([invalidMeld]), 0)
})

test('isValidMeld accepts a legal chi', () => {
  assert.equal(
    isValidMeld({
      type: 'chi',
      tiles: [
        tile('bamboo', 3),
        tile('bamboo', 4),
        tile('bamboo', 5),
      ],
    }),
    true,
  )
})

test('isValidMeld accepts a legal pong', () => {
  assert.equal(
    isValidMeld({
      type: 'pong',
      tiles: [
        tile('dots', 8, 0),
        tile('dots', 8, 1),
        tile('dots', 8, 2),
      ],
    }),
    true,
  )
})

test('isValidMeld accepts a legal kong', () => {
  assert.equal(
    isValidMeld({
      type: 'kong',
      tiles: [
        tile('characters', 9, 0),
        tile('characters', 9, 1),
        tile('characters', 9, 2),
        tile('characters', 9, 3),
      ],
    }),
    true,
  )
})

test('isValidMeld rejects a non-consecutive chi', () => {
  assert.equal(
    isValidMeld({
      type: 'chi',
      tiles: [
        tile('bamboo', 2),
        tile('bamboo', 4),
        tile('bamboo', 5),
      ],
    }),
    false,
  )
})

test('isValidMeld rejects a pong with different tiles', () => {
  assert.equal(
    isValidMeld({
      type: 'pong',
      tiles: [
        tile('dots', 5, 0),
        tile('dots', 5, 1),
        tile('dots', 6, 0),
      ],
    }),
    false,
  )
})

test('isValidMeld rejects a three-tile kong', () => {
  assert.equal(
    isValidMeld({
      type: 'kong',
      tiles: [
        tile('characters', 4, 0),
        tile('characters', 4, 1),
        tile('characters', 4, 2),
      ],
    }),
    false,
  )
})

test('drawTile enables win when the concealed hand and melds are complete', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  const { hand, melds } = winningStateWithMeldCount(1)
  game.players[0].hand = hand.slice(0, -1)
  game.players[0].melds = melds
  game.wall = [hand.at(-1)]
  const result = drawTile(game)

  assert.equal(result.gameState.players[0].hand.length, 14)
  assert.equal(result.gameState.canDeclareWin, true)
})

test('declareWin accepts a winning hand completed with melds', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  const { hand, melds } = winningStateWithMeldCount(2)
  game.currentPlayer = 0
  game.phase = 'waitingDiscard'
  game.players[0].hand = hand
  game.players[0].melds = melds
  const result = declareWin(game, 0)

  assert.equal(result.success, true)
  assert.equal(result.gameState.status, 'win')
  assert.equal(result.gameState.winner.id, 0)
})

test('computer wins after drawing a meld-aware winning tile', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  const { hand, melds } = winningStateWithMeldCount(1)
  game.currentPlayer = 1
  game.phase = 'waitingDraw'
  game.players[1].hand = hand.slice(0, -1)
  game.players[1].melds = melds
  game.wall = [hand.at(-1)]
  const result = runComputerTurn(game)

  assert.equal(result.gameState.status, 'win')
  assert.equal(result.gameState.winner.id, 1)
  assert.notEqual(result.gameState.scoringResult, null)
  assert.equal(
    result.gameState.scoringResult.patterns.some(
      (pattern) => pattern.key === 'selfDraw',
    ),
    true,
  )
})

test('runComputerTurn draws and discards for a computer player', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  game.currentPlayer = 1
  game.players[0].hand = repeatedHand('dots', 1)
  game.players[1].hand = repeatedHand('characters', 1)
  game.players[2].hand = repeatedHand('dots', 9)
  game.players[3].hand = repeatedHand('bamboo', 9)
  game.wall = [tile('characters', 9, 88)]
  const result = runComputerTurn(game)

  assert.equal(result.success, true)
  assert.equal(result.gameState.players[1].hand.length, 16)
  assert.equal(result.gameState.players[1].discardPile.length, 1)
  assert.equal(result.gameState.currentPlayer, 2)
  assert.equal(result.gameState.phase, 'waitingDraw')
})

test('drawTile ends in a draw when the wall is empty', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  game.wall = []
  const result = drawTile(game)

  assert.equal(result.success, false)
  assert.equal(result.gameState.status, 'draw')
})

test('human win scores 100', () => {
  const game = {
    status: 'win',
  }
  assert.equal(calculateMahjongScore(game, 0), 100)
})

test('computer win scores zero', () => {
  const game = {
    status: 'win',
  }
  assert.equal(calculateMahjongScore(game, 2), 0)
})

test('canChi allows the next player with a valid sequence', () => {
  const hand = [tile('characters', 3), tile('characters', 4)]
  assert.equal(canChi(hand, tile('characters', 5), 1, 0), true)
})

test('canChi rejects a player who is not next in turn order', () => {
  const hand = [tile('characters', 3), tile('characters', 4)]
  assert.equal(canChi(hand, tile('characters', 5), 2, 0), false)
})

test('honor tiles cannot be used for chi', () => {
  const hand = [tile('wind', 'south'), tile('wind', 'west')]
  assert.deepEqual(getChiOptions(hand, tile('wind', 'east')), [])
  assert.equal(canChi(hand, tile('wind', 'east'), 1, 0), false)
})

test('flower tiles cannot be used for chi, pong, or kong', () => {
  const flower = tile('flower', 'spring')
  assert.equal(canChi([], flower, 1, 0), false)
  assert.equal(canPong([flower, flower], flower), false)
  assert.equal(canKong([flower, flower, flower], flower), false)
})

test('getChiOptions returns every sequence available around five characters', () => {
  const hand = [
    tile('characters', 3),
    tile('characters', 4),
    tile('characters', 6),
    tile('characters', 7),
  ]
  const options = getChiOptions(hand, tile('characters', 5))

  assert.deepEqual(
    options.map((option) => option.meldTiles.map((meldTile) => meldTile.rank)),
    [
      [3, 4, 5],
      [4, 5, 6],
      [5, 6, 7],
    ],
  )
})

test('canPong accepts two matching tiles', () => {
  assert.equal(
    canPong(
      [tile('dots', 6, 0), tile('dots', 6, 1)],
      tile('dots', 6, 9),
    ),
    true,
  )
})

test('honor tiles can be ponged', () => {
  assert.equal(
    canPong(
      [tile('dragon', 'red', 0), tile('dragon', 'red', 1)],
      tile('dragon', 'red', 2),
    ),
    true,
  )
})

test('canKong accepts three matching tiles', () => {
  assert.equal(
    canKong(
      [tile('bamboo', 8, 0), tile('bamboo', 8, 1), tile('bamboo', 8, 2)],
      tile('bamboo', 8, 9),
    ),
    true,
  )
})

test('honor tiles can form exposed, concealed, and added kongs', () => {
  const honorHand = [
    tile('wind', 'north', 0),
    tile('wind', 'north', 1),
    tile('wind', 'north', 2),
    tile('wind', 'north', 3),
  ]
  assert.equal(canKong(honorHand.slice(0, 3), tile('wind', 'north', 9)), true)
  assert.equal(getAvailableConcealedKongs(honorHand)[0].tileKey, 'wind-north')

  const player = {
    hand: [tile('dragon', 'green', 3)],
    melds: [{
      type: 'pong',
      kongType: null,
      tiles: [
        tile('dragon', 'green', 0),
        tile('dragon', 'green', 1),
        tile('dragon', 'green', 2),
      ],
      fromPlayer: 1,
      concealed: false,
    }],
  }
  assert.equal(getAvailableAddedKongs(player)[0].tileKey, 'dragon-green')
})

test('flowers are excluded from concealed and added kong options', () => {
  const flowers = [
    tile('flower', 'spring', 0),
    tile('flower', 'spring', 1),
    tile('flower', 'spring', 2),
    tile('flower', 'spring', 3),
  ]
  assert.deepEqual(getAvailableConcealedKongs(flowers), [])
  assert.deepEqual(
    getAvailableAddedKongs({
      hand: [tile('flower', 'spring', 3)],
      melds: [{
        type: 'pong',
        tiles: flowers.slice(0, 3),
      }],
    }),
    [],
  )
})

test('flower tiles cannot be discarded', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  game.currentPlayer = 0
  game.phase = 'waitingDiscard'
  game.players[0].hand = [tile('flower', 'spring')]
  const result = discardTile(game, 0, 0)

  assert.equal(result.success, false)
  assert.match(result.message, /Flower tiles cannot be discarded/)
})

test('drawTile moves flowers to flowerTiles before drawing a playable tile', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  game.players[0].hand = repeatedHand('characters', 1, 16)
  game.players[0].flowerTiles = []
  game.wall = [
    tile('flower', 'summer'),
    tile('flower', 'orchid'),
    tile('dots', 5),
  ]
  const result = drawTile(game)

  assert.equal(result.success, true)
  assert.equal(result.gameState.players[0].hand.length, 17)
  assert.equal(result.gameState.players[0].hand.some((handTile) => handTile.suit === 'flower'), false)
  assert.equal(result.gameState.players[0].flowerTiles.length, 2)
})

test('discardTile enters claim phase when another player can claim', () => {
  const game = claimTestGame({
    claimantIndex: 2,
    claimantHand: [tile('characters', 5, 0), tile('characters', 5, 1)],
  })
  const result = discardForClaim(game)

  assert.equal(result.phase, 'claim')
  assert.equal(result.claimPhase.active, true)
  assert.deepEqual(result.claimPhase.eligiblePlayers, [2])
})

test('canClaimWin accepts another player discard that completes the hand', () => {
  const claimState = discardWinGame()

  assert.equal(canClaimWin(claimState, 0), true)
  assert.equal(getAvailableClaims(claimState, 0).canWin, true)
  assert.equal(claimState.phase, 'claim')
  assert.deepEqual(claimState.claimPhase.winClaims, [
    { playerIndex: 0, claimType: 'win' },
  ])
  assert.match(claimState.message, /You can win/)
})

test('canClaimWin rejects the discarder and an incomplete hand', () => {
  const claimState = discardWinGame()

  assert.equal(canClaimWin(claimState, 3), false)
  claimState.players[0].hand = repeatedHand('bamboo', 1, 16)
  assert.equal(canClaimWin(claimState, 0), false)
})

test('enterClaimPhase includes every player whose hand can claim win', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  const completeHand = winningHand()
  const winningTile = completeHand.find(
    (handTile) => handTile.suit === 'dots' && handTile.rank === 7,
  )
  const waitingHand = completeHand.filter(
    (handTile) => handTile.id !== winningTile.id,
  )
  game.players[0].hand = waitingHand
  game.players[1].hand = waitingHand.map((handTile, index) => ({
    ...handTile,
    id: `${handTile.id}-second-${index}`,
  }))
  game.players[2].hand = []
  game.players[3].hand = []

  const result = enterClaimPhase(game, winningTile, 3).gameState

  assert.deepEqual(result.claimPhase.winClaims, [
    { playerIndex: 0, claimType: 'win' },
    { playerIndex: 1, claimType: 'win' },
  ])
  assert.equal(result.claimPhase.eligiblePlayers.includes(0), true)
  assert.equal(result.claimPhase.eligiblePlayers.includes(1), true)
})

test('claimWin completes a discard win and clears the claim phase', () => {
  const claimState = discardWinGame()
  const result = claimWin(claimState, 0)

  assert.equal(result.success, true)
  assert.equal(result.gameState.status, 'win')
  assert.equal(result.gameState.phase, 'ended')
  assert.equal(result.gameState.winner.id, 0)
  assert.equal(result.gameState.winContext.type, 'discard')
  assert.equal(result.gameState.winContext.fromPlayer, 3)
  assert.equal(result.gameState.scoringResult.winnerIndex, 0)
  assert.equal(result.gameState.claimPhase.active, false)
  assert.deepEqual(result.gameState.claimPhase.winClaims, [])
  assert.deepEqual(result.gameState.lastDiscard, {
    tile: null,
    fromPlayer: null,
  })
  assert.equal(
    result.gameState.scoringResult.payments[3].delta,
    -(result.gameState.scoringResult.points * 3),
  )
  assert.match(result.message, /wins by discard/)
})

test('autoComputerClaim always takes a winning claim before pong', () => {
  const claimState = discardWinGame({
    winnerIndex: 1,
    discardedBy: 0,
    additionalHands: {
      2: [
        tile('dots', 7, 20),
        tile('dots', 7, 21),
      ],
    },
  })
  const pongResult = claimDiscard(claimState, 2, 'pong')
  const result = autoComputerClaim(claimState)

  assert.equal(pongResult.success, false)
  assert.match(pongResult.message, /win claim has priority/i)
  assert.equal(result.success, true)
  assert.equal(result.gameState.status, 'win')
  assert.equal(result.gameState.winner.id, 1)
  assert.equal(result.gameState.players[2].melds.length, 0)
})

test('autoComputerClaim always takes a winning claim before kong', () => {
  const claimState = discardWinGame({
    winnerIndex: 1,
    discardedBy: 0,
    additionalHands: {
      2: [
        tile('dots', 7, 20),
        tile('dots', 7, 21),
        tile('dots', 7, 22),
      ],
    },
  })
  const kongResult = claimDiscard(claimState, 2, 'kong')
  const result = autoComputerClaim(claimState)

  assert.equal(kongResult.success, false)
  assert.match(kongResult.message, /win claim has priority/i)
  assert.equal(result.success, true)
  assert.equal(result.gameState.status, 'win')
  assert.equal(result.gameState.winner.id, 1)
  assert.equal(result.gameState.players[2].melds.length, 0)
})

test('claiming pong creates a pong meld', () => {
  const game = claimTestGame({
    claimantIndex: 2,
    claimantHand: [tile('characters', 5, 0), tile('characters', 5, 1)],
  })
  const claimed = claimDiscard(discardForClaim(game), 2, 'pong').gameState

  assert.equal(claimed.players[2].melds.length, 1)
  assert.equal(claimed.players[2].melds[0].type, 'pong')
  assert.equal(claimed.players[2].melds[0].tiles.length, 3)
})

test('claiming pong removes two matching tiles from hand', () => {
  const claimantHand = [
    tile('characters', 5, 0),
    tile('characters', 5, 1),
    tile('dots', 2, 0),
  ]
  const game = claimTestGame({ claimantIndex: 2, claimantHand })
  const claimed = claimDiscard(discardForClaim(game), 2, 'pong').gameState

  assert.equal(claimed.players[2].hand.length, 1)
  assert.equal(claimed.players[2].hand[0].suit, 'dots')
})

test('claiming pong removes the claimed tile from source discard pile', () => {
  const game = claimTestGame({
    claimantIndex: 2,
    claimantHand: [tile('characters', 5, 0), tile('characters', 5, 1)],
  })
  const claimed = claimDiscard(discardForClaim(game), 2, 'pong').gameState
  assert.equal(claimed.players[0].discardPile.length, 0)
})

test('claiming chi makes the claimant the current player', () => {
  const game = claimTestGame({
    claimantIndex: 1,
    claimantHand: [tile('characters', 4), tile('characters', 6)],
  })
  const claimState = discardForClaim(game)
  const option = getChiOptions(
    claimState.players[1].hand,
    claimState.claimPhase.discardedTile,
  )[0]
  const claimed = claimDiscard(claimState, 1, 'chi', option).gameState

  assert.equal(claimed.currentPlayer, 1)
  assert.equal(claimed.phase, 'waitingDiscard')
})

test('claiming chi enables win when the resulting hand and melds are complete', () => {
  const game = claimTestGame({
    discardedTile: tile('characters', 6, 99),
    claimantIndex: 1,
    claimantHand: [
      tile('characters', 4, 0),
      tile('characters', 4, 1),
      tile('characters', 5, 0),
      tile('characters', 7, 0),
      tile('dots', 8, 0),
      tile('dots', 8, 1),
      tile('dots', 8, 2),
    ],
  })
  game.players[1].melds = winningSets()
    .slice(0, 3)
    .map(meldFromSet)

  const claimState = discardForClaim(game)
  const chiOption = getChiOptions(
    claimState.players[1].hand,
    claimState.claimPhase.discardedTile,
  ).find((option) =>
    option.tilesFromHand.some((optionTile) => optionTile.rank === 7),
  )
  const claimed = claimDiscard(claimState, 1, 'chi', chiOption).gameState

  assert.equal(claimed.canDeclareWin, true)
  assert.equal(claimed.winContext.type, 'discard')
  assert.equal(claimed.winContext.fromPlayer, 0)
  assert.match(claimed.message, /can declare win/)

  const winResult = declareWin(claimed, 1)
  assert.equal(winResult.success, true)
  assert.equal(winResult.gameState.status, 'win')
  assert.equal(
    winResult.gameState.scoringResult.payments[0].delta,
    -(winResult.gameState.scoringResult.points * 3),
  )
})

test('passing the only claim advances to the player after the discarder', () => {
  const game = claimTestGame({
    claimantIndex: 2,
    claimantHand: [tile('characters', 5, 0), tile('characters', 5, 1)],
  })
  const passed = passClaim(discardForClaim(game), 2).gameState

  assert.equal(passed.currentPlayer, 1)
  assert.equal(passed.phase, 'waitingDraw')
})

test('claiming an exposed kong creates a kong meld', () => {
  const game = claimTestGame({
    claimantIndex: 3,
    claimantHand: [
      tile('characters', 5, 0),
      tile('characters', 5, 1),
      tile('characters', 5, 2),
    ],
  })
  const claimed = claimDiscard(discardForClaim(game), 3, 'kong').gameState

  assert.equal(claimed.players[3].melds[0].type, 'kong')
  assert.equal(claimed.players[3].melds[0].kongType, 'exposed')
  assert.equal(claimed.players[3].melds[0].tiles.length, 4)
  assert.equal(claimed.phase, 'waitingKongDraw')
  assert.equal(claimed.kongDrawPending.active, true)
})

test('claim completion clears lastDiscard', () => {
  const game = claimTestGame({
    claimantIndex: 2,
    claimantHand: [tile('characters', 5, 0), tile('characters', 5, 1)],
  })
  const claimed = claimDiscard(discardForClaim(game), 2, 'pong').gameState

  assert.deepEqual(claimed.lastDiscard, { tile: null, fromPlayer: null })
  assert.equal(claimed.claimPhase.active, false)
})

test('discard with no available claim moves directly to next waitingDraw', () => {
  const result = discardForClaim(claimTestGame())
  assert.equal(result.claimPhase.active, false)
  assert.equal(result.currentPlayer, 1)
  assert.equal(result.phase, 'waitingDraw')
})

test('autoComputerClaim waits while the human has a claim decision', () => {
  const game = createInitialMahjongGame(createMahjongDeck())
  game.currentPlayer = 3
  game.phase = 'waitingDiscard'
  game.players[3].hand = [
    ...repeatedHand('dots', 9, 16),
    tile('characters', 5, 99),
  ]
  game.players[0].hand = [
    tile('characters', 4, 0),
    tile('characters', 6, 0),
  ]
  game.players[1].hand = []
  game.players[2].hand = []

  const claimState = discardTile(
    game,
    3,
    game.players[3].hand.length - 1,
  ).gameState
  const result = autoComputerClaim(claimState)

  assert.equal(result.success, false)
  assert.equal(result.gameState.claimPhase.active, true)
  assert.match(result.message, /Waiting for your claim/)
})

test('autoComputerClaim prioritizes kong over pong when both are available', () => {
  const game = claimTestGame({
    claimantIndex: 2,
    claimantHand: [
      tile('characters', 5, 0),
      tile('characters', 5, 1),
      tile('characters', 5, 2),
    ],
  })
  const originalRandom = Math.random
  Math.random = () => 0

  try {
    const result = autoComputerClaim(discardForClaim(game))
    assert.equal(result.success, true)
    assert.equal(result.gameState.players[2].melds[0].type, 'kong')
  } finally {
    Math.random = originalRandom
  }
})

test('getAvailableConcealedKongs finds four matching tiles', () => {
  const hand = [
    tile('characters', 3, 0),
    tile('characters', 3, 1),
    tile('characters', 3, 2),
    tile('characters', 3, 3),
    tile('dots', 5, 0),
  ]
  const options = getAvailableConcealedKongs(hand)

  assert.equal(options.length, 1)
  assert.equal(options[0].tileKey, 'characters-3')
  assert.equal(options[0].tiles.length, 4)
  assert.equal(canConcealedKong(hand), true)
})

test('getAvailableConcealedKongs returns no option without four matches', () => {
  const hand = [
    tile('characters', 3, 0),
    tile('characters', 3, 1),
    tile('characters', 3, 2),
  ]
  assert.deepEqual(getAvailableConcealedKongs(hand), [])
  assert.equal(canConcealedKong(hand), false)
})

test('declareConcealedKong creates a concealed kong meld', () => {
  const game = kongTurnGame()
  game.players[0].hand = [
    tile('bamboo', 6, 0),
    tile('bamboo', 6, 1),
    tile('bamboo', 6, 2),
    tile('bamboo', 6, 3),
    ...repeatedHand('dots', 1, 13),
  ]
  const result = declareConcealedKong(game, 0, 'bamboo-6')
  const meld = result.gameState.players[0].melds[0]

  assert.equal(result.success, true)
  assert.equal(meld.type, 'kong')
  assert.equal(meld.kongType, 'concealed')
  assert.equal(meld.concealed, true)
  assert.equal(meld.fromPlayer, null)
})

test('declareConcealedKong removes four tiles and waits for replacement draw', () => {
  const game = kongTurnGame()
  game.players[0].hand = [
    tile('dots', 4, 0),
    tile('dots', 4, 1),
    tile('dots', 4, 2),
    tile('dots', 4, 3),
    ...repeatedHand('bamboo', 1, 13),
  ]
  const result = declareConcealedKong(game, 0, 'dots-4')

  assert.equal(result.gameState.players[0].hand.length, 13)
  assert.equal(result.gameState.phase, 'waitingKongDraw')
  assert.deepEqual(result.gameState.kongDrawPending, {
    active: true,
    playerIndex: 0,
    kongType: 'concealed',
  })
  assert.equal(result.gameState.robKongPhase.active, false)
})

test('waitingDraw allows a concealed kong of four green dragons', () => {
  const game = kongTurnGame()
  game.phase = 'waitingDraw'
  game.players[0].hand = [
    tile('dragon', 'green', 0),
    tile('dragon', 'green', 1),
    tile('dragon', 'green', 2),
    tile('dragon', 'green', 3),
    ...repeatedHand('characters', 2, 12),
  ]

  const options = getAvailableConcealedKongs(game.players[0].hand)
  const greenDragonOption = options.find(
    (option) => option.tileKey === 'dragon-green',
  )
  assert.ok(greenDragonOption)
  assert.equal(greenDragonOption.tiles.length, 4)

  const result = declareConcealedKong(game, 0, 'dragon-green')
  const player = result.gameState.players[0]

  assert.equal(result.success, true)
  assert.equal(player.hand.length, 12)
  assert.equal(player.hand.some((handTile) => getTileKey(handTile) === 'dragon-green'), false)
  assert.equal(player.melds.length, 1)
  assert.equal(player.melds[0].type, 'kong')
  assert.equal(player.melds[0].kongType, 'concealed')
  assert.equal(result.gameState.phase, 'waitingKongDraw')
  assert.deepEqual(result.gameState.kongDrawPending, {
    active: true,
    playerIndex: 0,
    kongType: 'concealed',
  })
  assert.equal(
    result.message,
    'Concealed kong declared. Draw a replacement tile.',
  )
})

test('waitingDraw concealed kong replacement returns the same player to discard', () => {
  const game = kongTurnGame()
  game.phase = 'waitingDraw'
  game.players[0].hand = [
    tile('dots', 7, 0),
    tile('dots', 7, 1),
    tile('dots', 7, 2),
    tile('dots', 7, 3),
    ...repeatedHand('bamboo', 2, 12),
  ]

  const kongResult = declareConcealedKong(game, 0, 'dots-7')
  const drawResult = drawAfterKong(kongResult.gameState)

  assert.equal(drawResult.success, true)
  assert.equal(drawResult.gameState.currentPlayer, 0)
  assert.equal(drawResult.gameState.players[0].hand.length, 13)
  assert.equal(drawResult.gameState.phase, 'waitingDiscard')
  assert.equal(drawResult.gameState.kongDrawPending.active, false)
})

test('declareConcealedKong rejects flower tiles in waitingDraw', () => {
  const game = kongTurnGame()
  game.phase = 'waitingDraw'
  game.players[0].hand = [
    tile('flower', 'spring', 0),
    tile('flower', 'spring', 1),
    tile('flower', 'spring', 2),
    tile('flower', 'spring', 3),
  ]

  const result = declareConcealedKong(game, 0, 'flower-spring')

  assert.equal(result.success, false)
  assert.equal(result.gameState.players[0].hand.length, 4)
  assert.equal(result.gameState.players[0].melds.length, 0)
})

test('drawAfterKong draws a replacement tile and returns to discard phase', () => {
  const game = kongTurnGame()
  game.players[0].hand = repeatedHand('characters', 2, 13)
  game.phase = 'waitingKongDraw'
  game.kongDrawPending = {
    active: true,
    playerIndex: 0,
    kongType: 'concealed',
  }
  const result = drawAfterKong(game)

  assert.equal(result.success, true)
  assert.equal(result.gameState.players[0].hand.length, 14)
  assert.equal(result.gameState.wall.length, 1)
  assert.equal(result.gameState.phase, 'waitingDiscard')
  assert.equal(result.gameState.kongDrawPending.active, false)
})

test('drawAfterKong moves replacement flowers to flowerTiles', () => {
  const game = kongTurnGame()
  game.players[0].hand = repeatedHand('characters', 2, 13)
  game.players[0].flowerTiles = []
  game.wall = [
    tile('flower', 'winter'),
    tile('flower', 'chrysanthemum'),
    tile('bamboo', 8),
  ]
  game.phase = 'waitingKongDraw'
  game.kongDrawPending = {
    active: true,
    playerIndex: 0,
    kongType: 'concealed',
  }
  const result = drawAfterKong(game)

  assert.equal(result.success, true)
  assert.equal(result.gameState.players[0].flowerTiles.length, 2)
  assert.equal(result.gameState.players[0].hand.some((handTile) => handTile.suit === 'flower'), false)
  assert.equal(result.gameState.phase, 'waitingDiscard')
})

test('drawAfterKong enables win when replacement completes a hand with melds', () => {
  const game = kongTurnGame()
  const { hand, melds } = winningStateWithMeldCount(1)
  game.players[0].hand = hand.slice(0, -1)
  game.players[0].melds = melds
  game.wall = [hand.at(-1)]
  game.phase = 'waitingKongDraw'
  game.kongDrawPending = {
    active: true,
    playerIndex: 0,
    kongType: 'concealed',
  }
  const result = drawAfterKong(game)

  assert.equal(result.success, true)
  assert.equal(result.gameState.canDeclareWin, true)

  const winResult = declareWin(result.gameState, 0)
  assert.equal(
    winResult.gameState.scoringResult.patterns.some(
      (pattern) => pattern.key === 'kongDraw',
    ),
    true,
  )
})

test('getAvailableAddedKongs finds a pong with its fourth tile in hand', () => {
  const game = kongTurnGame()
  game.players[0].melds = [pongMeld('characters', 7)]
  game.players[0].hand = [tile('characters', 7, 3)]
  const options = getAvailableAddedKongs(game.players[0])

  assert.equal(options.length, 1)
  assert.equal(options[0].tileKey, 'characters-7')
})

test('declareAddedKong enters rob kong phase when another player can win', () => {
  const game = kongTurnGame()
  game.players[0].melds = [pongMeld('bamboo', 9)]
  game.players[0].hand = [tile('bamboo', 9, 3)]
  game.players[2].hand = winningHand().slice(0, -1)
  const result = declareAddedKong(game, 0, 'bamboo-9')

  assert.equal(result.success, true)
  assert.equal(result.gameState.phase, 'robKong')
  assert.equal(result.gameState.robKongPhase.active, true)
  assert.deepEqual(result.gameState.robKongPhase.canRobPlayers, [2])
  assert.equal(result.gameState.players[0].melds[0].type, 'pong')
})

test('canRobKong accepts a tile that completes a winning hand', () => {
  const hand = winningHand().slice(0, -1)
  assert.equal(canRobKong(hand, tile('bamboo', 9, 9)), true)
})

test('canRobKong accounts for the player’s existing melds', () => {
  const { hand, melds } = winningStateWithMeldCount(1)
  assert.equal(
    canRobKong(hand.slice(0, -1), hand.at(-1), melds),
    true,
  )
})

test('robKongWin ends the game with the robbing player as winner', () => {
  const game = kongTurnGame()
  game.players[0].melds = [pongMeld('bamboo', 9)]
  game.players[0].hand = [tile('bamboo', 9, 3)]
  game.players[2].hand = winningHand().slice(0, -1)
  const robState = declareAddedKong(game, 0, 'bamboo-9').gameState
  const result = robKongWin(robState, 2)

  assert.equal(result.gameState.status, 'win')
  assert.equal(result.gameState.winner.id, 2)
  assert.match(result.gameState.message, /Rob kong win/)
  assert.equal(
    result.gameState.scoringResult.patterns.some(
      (pattern) => pattern.key === 'robKong',
    ),
    true,
  )
  assert.equal(
    result.gameState.scoringResult.payments[0].delta,
    -(result.gameState.scoringResult.points * 3),
  )
})

test('passing the only rob kong opportunity completes the added kong', () => {
  const game = kongTurnGame()
  game.players[0].melds = [pongMeld('bamboo', 9)]
  game.players[0].hand = [tile('bamboo', 9, 3)]
  game.players[2].hand = winningHand().slice(0, -1)
  const robState = declareAddedKong(game, 0, 'bamboo-9').gameState
  const result = passRobKong(robState, 2)
  const meld = result.gameState.players[0].melds[0]

  assert.equal(meld.type, 'kong')
  assert.equal(meld.kongType, 'added')
  assert.equal(meld.tiles.length, 4)
  assert.equal(result.gameState.players[0].hand.length, 0)
  assert.equal(result.gameState.phase, 'waitingKongDraw')
  assert.equal(result.gameState.robKongPhase.active, false)
})

test('added kong completes immediately when nobody can rob it', () => {
  const game = kongTurnGame()
  game.players[0].melds = [pongMeld('dots', 3)]
  game.players[0].hand = [tile('dots', 3, 3)]
  game.players[1].hand = repeatedHand('characters', 1, 16)
  game.players[2].hand = repeatedHand('characters', 2, 16)
  game.players[3].hand = repeatedHand('characters', 3, 16)
  const result = declareAddedKong(game, 0, 'dots-3')

  assert.equal(result.gameState.players[0].melds[0].type, 'kong')
  assert.equal(result.gameState.players[0].melds[0].kongType, 'added')
  assert.equal(result.gameState.phase, 'waitingKongDraw')
})

test('drawAfterKong ends the game in a draw when the wall is empty', () => {
  const game = kongTurnGame()
  game.wall = []
  game.phase = 'waitingKongDraw'
  game.kongDrawPending = {
    active: true,
    playerIndex: 0,
    kongType: 'exposed',
  }
  const result = drawAfterKong(game)

  assert.equal(result.success, false)
  assert.equal(result.gameState.status, 'draw')
  assert.match(result.gameState.message, /Wall is empty/)
})

test('computer turn automatically draws a pending kong replacement tile', () => {
  const game = kongTurnGame()
  game.currentPlayer = 1
  game.phase = 'waitingKongDraw'
  game.players[1].hand = repeatedHand('characters', 1, 13)
  game.players[0].hand = repeatedHand('dots', 2, 16)
  game.players[2].hand = repeatedHand('dots', 3, 16)
  game.players[3].hand = repeatedHand('bamboo', 4, 16)
  game.kongDrawPending = {
    active: true,
    playerIndex: 1,
    kongType: 'exposed',
  }
  const result = runComputerTurn(game)

  assert.equal(result.success, true)
  assert.equal(result.gameState.kongDrawPending.active, false)
  assert.equal(result.gameState.players[1].hand.length, 13)
  assert.equal(result.gameState.players[1].discardPile.length, 1)
})

test('getTileKey remains the shared key for kong lookup', () => {
  assert.equal(getTileKey(tile('characters', 8, 3)), 'characters-8')
})
