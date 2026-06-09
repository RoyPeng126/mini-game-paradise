import { calculatePayments, SCORING_MODES } from './scoring.js'
import {
  drawTileSkippingFlowers,
  isFlowerTile,
  resolveInitialFlowers,
} from './flowerLogic.js'

export const NUMBERED_SUITS = ['characters', 'dots', 'bamboo']
export const WIND_RANKS = ['east', 'south', 'west', 'north']
export const DRAGON_RANKS = ['red', 'green', 'white']
export const FLOWER_RANKS = [
  'spring',
  'summer',
  'autumn',
  'winter',
  'plum',
  'orchid',
  'bamboo',
  'chrysanthemum',
]
export const MAHJONG_SUITS = [...NUMBERED_SUITS, 'wind', 'dragon', 'flower']

const SUIT_LABELS = {
  characters: '萬',
  dots: '筒',
  bamboo: '索',
}

const HONOR_LABELS = {
  'wind-east': '東',
  'wind-south': '南',
  'wind-west': '西',
  'wind-north': '北',
  'dragon-red': '中',
  'dragon-green': '發',
  'dragon-white': '白',
}

const FLOWER_LABELS = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
  plum: '梅',
  orchid: '蘭',
  bamboo: '竹',
  chrysanthemum: '菊',
}

const SEATS = ['East', 'South', 'West', 'North']

function createPlayers(dealer = 0) {
  return assignSeats(
    Array.from({ length: 4 }, (_, index) => ({
      id: index,
      name: index === 0 ? 'You' : `Computer ${index}`,
      seat: null,
      isHuman: index === 0,
      hand: [],
      discardPile: [],
      melds: [],
      flowerTiles: [],
    })),
    dealer,
  )
}

export function createMahjongDeck() {
  const numberedTiles = NUMBERED_SUITS.flatMap((suit) =>
    Array.from({ length: 9 }, (_, rankIndex) => rankIndex + 1).flatMap((rank) =>
      Array.from({ length: 4 }, (_, copyIndex) => ({
        id: `${suit}-${rank}-${copyIndex}`,
        suit,
        rank,
        label: `${rank}${SUIT_LABELS[suit]}`,
      })),
    ),
  )
  const honorTiles = [
    ...WIND_RANKS.map((rank) => ({ suit: 'wind', rank })),
    ...DRAGON_RANKS.map((rank) => ({ suit: 'dragon', rank })),
  ].flatMap(({ suit, rank }) =>
    Array.from({ length: 4 }, (_, copyIndex) => ({
      id: `${suit}-${rank}-${copyIndex}`,
      suit,
      rank,
      label: HONOR_LABELS[`${suit}-${rank}`],
    })),
  )

  const flowerTiles = FLOWER_RANKS.map((rank) => ({
    id: `flower-${rank}-0`,
    suit: 'flower',
    rank,
    label: FLOWER_LABELS[rank],
  }))

  return [...numberedTiles, ...honorTiles, ...flowerTiles]
}

export function shuffleTiles(tiles) {
  const shuffled = [...tiles]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ]
  }

  return shuffled
}

export function getTileKey(tile) {
  return `${tile.suit}-${tile.rank}`
}

export function isSameTile(first, second) {
  return Boolean(
    first &&
      second &&
      first.suit === second.suit &&
      first.rank === second.rank,
  )
}

export function sortHand(hand) {
  return [...hand].sort((first, second) => {
    const suitDifference =
      MAHJONG_SUITS.indexOf(first.suit) - MAHJONG_SUITS.indexOf(second.suit)
    if (suitDifference) return suitDifference
    if (NUMBERED_SUITS.includes(first.suit)) return first.rank - second.rank
    const ranks =
      first.suit === 'wind'
        ? WIND_RANKS
        : first.suit === 'dragon'
          ? DRAGON_RANKS
          : FLOWER_RANKS
    return ranks.indexOf(first.rank) - ranks.indexOf(second.rank)
  })
}

export function cloneGameState(gameState) {
  return {
    ...gameState,
    wall: [...gameState.wall],
    dice: gameState.dice
      ? { ...gameState.dice, values: [...gameState.dice.values] }
      : { values: [], total: 0 },
    seatAssignments: (gameState.seatAssignments ?? []).map((assignment) => ({
      ...assignment,
    })),
    players: gameState.players.map((player) => ({
      ...player,
      hand: [...player.hand],
      flowerTiles: [...(player.flowerTiles ?? [])],
      discardPile: [...player.discardPile],
      melds: player.melds.map((meld) =>
        Array.isArray(meld)
          ? [...meld]
          : { ...meld, tiles: [...(meld.tiles ?? [])] },
      ),
    })),
    winner: gameState.winner ? { ...gameState.winner } : null,
    winContext: gameState.winContext ? { ...gameState.winContext } : null,
    scoringResult: gameState.scoringResult
      ? {
          ...gameState.scoringResult,
          patterns: gameState.scoringResult.patterns.map((pattern) => ({
            ...pattern,
          })),
          payments: gameState.scoringResult.payments.map((payment) => ({
            ...payment,
          })),
        }
      : null,
    lastDiscard: gameState.lastDiscard
      ? { ...gameState.lastDiscard }
      : { tile: null, fromPlayer: null },
    claimPhase: gameState.claimPhase
      ? {
          ...gameState.claimPhase,
          eligiblePlayers: [...gameState.claimPhase.eligiblePlayers],
          claims: gameState.claimPhase.claims.map((claim) => ({ ...claim })),
        }
      : createEmptyClaimPhase(),
    kongDrawPending: gameState.kongDrawPending
      ? { ...gameState.kongDrawPending }
      : createEmptyKongDrawPending(),
    robKongPhase: gameState.robKongPhase
      ? {
          ...gameState.robKongPhase,
          eligiblePlayers: [...gameState.robKongPhase.eligiblePlayers],
          passedPlayers: [...gameState.robKongPhase.passedPlayers],
          canRobPlayers: [...gameState.robKongPhase.canRobPlayers],
        }
      : createEmptyRobKongPhase(),
  }
}

export function rollDice(randomFn = Math.random) {
  const values = [
    Math.floor(randomFn() * 6) + 1,
    Math.floor(randomFn() * 6) + 1,
  ]

  return {
    values,
    total: values[0] + values[1],
  }
}

export function determineDealerFromDice(total) {
  if (!Number.isInteger(total) || total < 2 || total > 12) return null
  return (total - 1) % 4
}

export function assignSeats(players, dealer) {
  if (!Array.isArray(players) || !Number.isInteger(dealer)) return []

  return players.map((player) => ({
    ...player,
    seat: SEATS[(player.id - dealer + players.length) % players.length],
  }))
}

export function createSetupMahjongGame(
  scoringMode = SCORING_MODES.SIMPLE,
) {
  const players = createPlayers(0)

  return {
    players,
    wall: [],
    currentPlayer: null,
    dealer: null,
    phase: 'setup',
    status: 'setup',
    setupPhase: 'rollingDice',
    dice: {
      values: [],
      total: 0,
    },
    seatAssignments: players.map((player) => ({
      playerId: player.id,
      seat: player.seat,
    })),
    winner: null,
    winContext: null,
    scoringResult: null,
    scoringMode,
    message: 'Roll dice to decide dealer.',
    moves: 0,
    canDeclareWin: false,
    lastDiscard: {
      tile: null,
      fromPlayer: null,
    },
    claimPhase: createEmptyClaimPhase(),
    kongDrawPending: createEmptyKongDrawPending(),
    robKongPhase: createEmptyRobKongPhase(),
  }
}

function createEmptyClaimPhase() {
  return {
    active: false,
    discardedTile: null,
    discardedBy: null,
    eligiblePlayers: [],
    claims: [],
  }
}

function createEmptyKongDrawPending() {
  return {
    active: false,
    playerIndex: null,
    kongType: null,
  }
}

function createEmptyRobKongPhase() {
  return {
    active: false,
    kongPlayer: null,
    addedTile: null,
    eligiblePlayers: [],
    passedPlayers: [],
    canRobPlayers: [],
  }
}

export function createInitialMahjongGame(
  tilesOrDealer = shuffleTiles(createMahjongDeck()),
  dealerArg = 0,
  scoringMode = SCORING_MODES.SIMPLE,
) {
  const dealer = Number.isInteger(tilesOrDealer) ? tilesOrDealer : dealerArg
  const tiles = Array.isArray(tilesOrDealer)
    ? tilesOrDealer
    : shuffleTiles(createMahjongDeck())
  let wall = [...tiles]
  const players = createPlayers(dealer)

  for (let round = 0; round < 16; round += 1) {
    for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
      const [tile, ...remainingWall] = wall
      players[playerIndex].hand.push(tile)
      wall = remainingWall
    }
  }

  let gameState = {
    players,
    wall,
    currentPlayer: dealer,
    dealer,
    phase: 'waitingDraw',
    status: 'playing',
    setupPhase: 'completed',
    dice: {
      values: [],
      total: 0,
    },
    seatAssignments: players.map((player) => ({
      playerId: player.id,
      seat: player.seat,
    })),
    winner: null,
    winContext: null,
    scoringResult: null,
    scoringMode,
    message: 'Game started',
    moves: 0,
    canDeclareWin: false,
    lastDiscard: {
      tile: null,
      fromPlayer: null,
    },
    claimPhase: createEmptyClaimPhase(),
    kongDrawPending: createEmptyKongDrawPending(),
    robKongPhase: createEmptyRobKongPhase(),
  }

  gameState = resolveInitialFlowers(gameState)
  gameState.players.forEach((player) => {
    player.hand = sortHand(player.hand)
  })
  return gameState
}

export function startGameAfterDice(
  gameState,
  tiles = shuffleTiles(createMahjongDeck()),
) {
  const dealer = determineDealerFromDice(gameState?.dice?.total)
  if (dealer === null) {
    return {
      ...gameState,
      message: 'Roll dice before starting the game.',
    }
  }

  const nextState = createInitialMahjongGame(
    tiles,
    dealer,
    gameState.scoringMode ?? SCORING_MODES.SIMPLE,
  )
  nextState.dice = {
    values: [...gameState.dice.values],
    total: gameState.dice.total,
  }
  nextState.setupPhase = 'completed'
  nextState.message = `Game started. ${nextState.players[dealer].name} is East and the dealer.`
  return nextState
}

export function getNextPlayerIndex(currentPlayer) {
  return (currentPlayer + 1) % 4
}

export function drawTile(gameState) {
  if (gameState.status !== 'playing') {
    return { gameState, success: false, message: 'Game is already over' }
  }

  if (gameState.phase !== 'waitingDraw') {
    return { gameState, success: false, message: 'Discard before drawing again' }
  }

  const drawResult = drawTileSkippingFlowers(
    gameState,
    gameState.currentPlayer,
  )
  if (!drawResult.success) {
    drawResult.gameState.canDeclareWin = false
    return drawResult
  }

  const nextState = drawResult.gameState
  const tile = drawResult.tile
  const player = nextState.players[nextState.currentPlayer]

  player.hand = sortHand(player.hand)
  nextState.phase = 'waitingDiscard'
  nextState.canDeclareWin = canWinWithMelds(player.hand, player.melds)
  nextState.winContext = {
    type: 'selfDraw',
    fromPlayer: null,
    winningTile: tile,
    isKongDraw: false,
    isRobKong: false,
    isSelfDraw: true,
  }
  nextState.message = `${player.name} drew a tile`

  return { gameState: nextState, success: true, message: nextState.message }
}

export function discardTile(gameState, playerIndex, tileIndex) {
  if (gameState.status !== 'playing') {
    return { gameState, success: false, message: 'Game is already over' }
  }

  if (playerIndex !== gameState.currentPlayer) {
    return { gameState, success: false, message: 'It is not that player’s turn' }
  }

  if (gameState.phase !== 'waitingDiscard') {
    return { gameState, success: false, message: 'Draw a tile before discarding' }
  }

  const player = gameState.players[playerIndex]
  if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= player.hand.length) {
    return { gameState, success: false, message: 'Select a valid tile' }
  }
  if (isFlowerTile(player.hand[tileIndex])) {
    return {
      gameState,
      success: false,
      message: 'Flower tiles cannot be discarded.',
    }
  }

  const nextState = cloneGameState(gameState)
  const nextPlayer = nextState.players[playerIndex]
  const [discardedTile] = nextPlayer.hand.splice(tileIndex, 1)

  nextPlayer.hand = sortHand(nextPlayer.hand)
  nextPlayer.discardPile.push(discardedTile)
  nextState.moves += 1
  nextState.canDeclareWin = false
  nextState.winContext = null

  return enterClaimPhase(nextState, discardedTile, playerIndex)
}

export function getChiOptions(hand, discardedTile) {
  if (!discardedTile || !NUMBERED_SUITS.includes(discardedTile.suit)) return []

  const options = []
  for (let startRank = discardedTile.rank - 2; startRank <= discardedTile.rank; startRank += 1) {
    if (startRank < 1 || startRank + 2 > 9) continue

    const requiredRanks = [startRank, startRank + 1, startRank + 2].filter(
      (rank) => rank !== discardedTile.rank,
    )
    const tilesFromHand = requiredRanks.map((rank) =>
      hand.find(
        (tile) =>
          tile.suit === discardedTile.suit &&
          tile.rank === rank,
      ),
    )

    if (tilesFromHand.every(Boolean)) {
      options.push({
        tilesFromHand,
        meldTiles: sortHand([...tilesFromHand, discardedTile]),
      })
    }
  }

  return options
}

export function canChi(hand, discardedTile, playerIndex, discardedBy) {
  return (
    playerIndex !== discardedBy &&
    playerIndex === getNextPlayerIndex(discardedBy) &&
    getChiOptions(hand, discardedTile).length > 0
  )
}

export function canPong(hand, discardedTile) {
  if (isFlowerTile(discardedTile)) return false
  return hand.filter((tile) => isSameTile(tile, discardedTile)).length >= 2
}

export function canKong(hand, discardedTile) {
  if (isFlowerTile(discardedTile)) return false
  return hand.filter((tile) => isSameTile(tile, discardedTile)).length >= 3
}

export function findTilesByKey(hand, tileKey) {
  return hand.filter((tile) => getTileKey(tile) === tileKey)
}

export function getAvailableConcealedKongs(hand) {
  const counts = new Map()

  for (const tile of hand) {
    if (isFlowerTile(tile)) continue
    const key = getTileKey(tile)
    const entry = counts.get(key) ?? { tileKey: key, tiles: [] }
    entry.tiles.push(tile)
    counts.set(key, entry)
  }

  return [...counts.values()].filter((entry) => entry.tiles.length >= 4)
}

export function canConcealedKong(hand) {
  return getAvailableConcealedKongs(hand).length > 0
}

export function getAvailableAddedKongs(player) {
  if (!player) return []

  return player.melds
    .map((meld, meldIndex) => {
      if (meld.type !== 'pong' || meld.tiles.length === 0) return null
      if (isFlowerTile(meld.tiles[0])) return null
      const tileKey = getTileKey(meld.tiles[0])
      const addedTile = findTilesByKey(player.hand, tileKey)[0]
      return addedTile ? { tileKey, tile: addedTile, meldIndex } : null
    })
    .filter(Boolean)
}

export function canAddedKong(player) {
  return getAvailableAddedKongs(player).length > 0
}

export function getAvailableClaims(gameState, playerIndex) {
  const discardedTile =
    gameState.claimPhase?.discardedTile ?? gameState.lastDiscard?.tile
  const discardedBy =
    gameState.claimPhase?.discardedBy ?? gameState.lastDiscard?.fromPlayer
  const player = gameState.players[playerIndex]

  if (
    !discardedTile ||
    !player ||
    playerIndex === discardedBy
  ) {
    return {
      canChi: false,
      chiOptions: [],
      canPong: false,
      canKong: false,
    }
  }

  const chiOptions = getChiOptions(player.hand, discardedTile)
  return {
    canChi:
      playerIndex === getNextPlayerIndex(discardedBy) &&
      chiOptions.length > 0,
    chiOptions,
    canPong: canPong(player.hand, discardedTile),
    canKong: canKong(player.hand, discardedTile),
  }
}

export function enterClaimPhase(gameState, discardedTile, discardedBy) {
  const nextState = cloneGameState(gameState)
  nextState.lastDiscard = {
    tile: discardedTile,
    fromPlayer: discardedBy,
  }
  nextState.claimPhase = {
    active: true,
    discardedTile,
    discardedBy,
    eligiblePlayers: [],
    claims: [],
  }

  nextState.claimPhase.eligiblePlayers = nextState.players
    .filter((player) => {
      if (player.id === discardedBy) return false
      const claims = getAvailableClaims(nextState, player.id)
      return claims.canChi || claims.canPong || claims.canKong
    })
    .map((player) => player.id)

  if (nextState.claimPhase.eligiblePlayers.length === 0) {
    nextState.claimPhase = createEmptyClaimPhase()
    nextState.lastDiscard = { tile: null, fromPlayer: null }
    nextState.currentPlayer = getNextPlayerIndex(discardedBy)
    nextState.phase = 'waitingDraw'
    nextState.message = `${nextState.players[discardedBy].name} discarded ${discardedTile.label}. Next player draws.`
  } else {
    nextState.phase = 'claim'
    nextState.message = 'Players may claim the discarded tile.'
  }

  return { gameState: nextState, success: true, message: nextState.message }
}

export function removeTilesFromHand(hand, tilesToRemove) {
  const nextHand = [...hand]

  for (const tileToRemove of tilesToRemove) {
    const tileIndex = nextHand.findIndex(
      (tile) =>
        tile.id === tileToRemove.id ||
        isSameTile(tile, tileToRemove),
    )
    if (tileIndex !== -1) nextHand.splice(tileIndex, 1)
  }

  return sortHand(nextHand)
}

export function addMeldToPlayer(gameState, playerIndex, meld) {
  const nextState = cloneGameState(gameState)
  nextState.players[playerIndex].melds = [
    ...nextState.players[playerIndex].melds,
    {
      ...meld,
      tiles: [...meld.tiles],
    },
  ]
  return nextState
}

export function getNextPlayerAfterClaim(playerIndex) {
  return playerIndex
}

function clearClaimState(gameState) {
  return {
    ...gameState,
    lastDiscard: { tile: null, fromPlayer: null },
    claimPhase: createEmptyClaimPhase(),
  }
}

export function claimDiscard(
  gameState,
  playerIndex,
  claimType,
  chiOption = null,
) {
  if (
    gameState.status !== 'playing' ||
    !gameState.claimPhase?.active ||
    !gameState.claimPhase.eligiblePlayers.includes(playerIndex)
  ) {
    return { gameState, success: false, message: 'Claim is not available' }
  }

  const available = getAvailableClaims(gameState, playerIndex)
  const discardedTile = gameState.claimPhase.discardedTile
  const discardedBy = gameState.claimPhase.discardedBy
  const player = gameState.players[playerIndex]
  let tilesFromHand = []
  let meldTiles = []

  if (claimType === 'chi') {
    if (!available.canChi) {
      return { gameState, success: false, message: 'Chi is not available' }
    }

    const selectedOption = chiOption ?? available.chiOptions[0]
    const validOption = available.chiOptions.find((option) =>
      option.tilesFromHand.every((tile, index) =>
        isSameTile(tile, selectedOption?.tilesFromHand?.[index]),
      ),
    )
    if (!validOption) {
      return { gameState, success: false, message: 'Select a valid chi option' }
    }
    tilesFromHand = validOption.tilesFromHand
    meldTiles = validOption.meldTiles
  } else if (claimType === 'pong') {
    if (!available.canPong) {
      return { gameState, success: false, message: 'Pong is not available' }
    }
    tilesFromHand = player.hand
      .filter((tile) => isSameTile(tile, discardedTile))
      .slice(0, 2)
    meldTiles = [...tilesFromHand, discardedTile]
  } else if (claimType === 'kong') {
    if (!available.canKong) {
      return { gameState, success: false, message: 'Kong is not available' }
    }
    tilesFromHand = player.hand
      .filter((tile) => isSameTile(tile, discardedTile))
      .slice(0, 3)
    meldTiles = [...tilesFromHand, discardedTile]
  } else {
    return { gameState, success: false, message: 'Unknown claim type' }
  }

  let nextState = cloneGameState(gameState)
  nextState.players[playerIndex].hand = removeTilesFromHand(
    nextState.players[playerIndex].hand,
    tilesFromHand,
  )

  const sourceDiscardPile = nextState.players[discardedBy].discardPile
  const sourceTile = sourceDiscardPile[sourceDiscardPile.length - 1]
  if (isSameTile(sourceTile, discardedTile)) sourceDiscardPile.pop()

  nextState = addMeldToPlayer(nextState, playerIndex, {
    type: claimType,
    kongType: claimType === 'kong' ? 'exposed' : null,
    tiles: meldTiles,
    fromPlayer: discardedBy,
    concealed: false,
  })
  nextState = clearClaimState(nextState)
  nextState.currentPlayer = getNextPlayerAfterClaim(playerIndex)

  if (claimType === 'kong') {
    nextState.canDeclareWin = false
    nextState.winContext = null
    nextState.phase = 'waitingKongDraw'
    nextState.kongDrawPending = {
      active: true,
      playerIndex,
      kongType: 'exposed',
    }
    nextState.message = 'Exposed kong claimed. Draw a replacement tile.'
  } else {
    const claimedPlayer = nextState.players[playerIndex]
    nextState.canDeclareWin = canWinWithMelds(
      claimedPlayer.hand,
      claimedPlayer.melds,
    )
    nextState.winContext = nextState.canDeclareWin
      ? {
          type: 'discard',
          fromPlayer: discardedBy,
          winningTile: discardedTile,
          isKongDraw: false,
          isRobKong: false,
          isSelfDraw: false,
        }
      : null
    nextState.phase = 'waitingDiscard'
    nextState.message = nextState.canDeclareWin
      ? `${claimedPlayer.name} claimed ${claimType} and can declare win.`
      : `${claimedPlayer.name} claimed ${claimType}. Please discard a tile.`
  }

  return { gameState: nextState, success: true, message: nextState.message }
}

export function completeKong(gameState, playerIndex, kongType) {
  if (
    gameState.status !== 'playing' ||
    playerIndex !== gameState.currentPlayer
  ) {
    return { gameState, success: false, message: 'Kong cannot be completed' }
  }

  const nextState = cloneGameState(gameState)

  if (kongType === 'added') {
    const tile = nextState.robKongPhase.addedTile
    const tileKey = tile ? getTileKey(tile) : null
    const player = nextState.players[playerIndex]
    const meld = player.melds.find(
      (candidate) =>
        candidate.type === 'pong' &&
        candidate.tiles[0] &&
        getTileKey(candidate.tiles[0]) === tileKey,
    )
    const handTile = tileKey
      ? findTilesByKey(player.hand, tileKey)[0]
      : null

    if (!meld || !handTile) {
      return { gameState, success: false, message: 'Added kong is no longer available' }
    }

    player.hand = removeTilesFromHand(player.hand, [handTile])
    meld.type = 'kong'
    meld.kongType = 'added'
    meld.concealed = false
    meld.tiles = [...meld.tiles, handTile]
  }

  nextState.robKongPhase = createEmptyRobKongPhase()
  nextState.kongDrawPending = {
    active: true,
    playerIndex,
    kongType,
  }
  nextState.phase = 'waitingKongDraw'
  nextState.canDeclareWin = false
  nextState.message =
    kongType === 'added'
      ? 'Added kong declared. Draw a replacement tile.'
      : 'Kong declared. Draw a replacement tile.'

  return { gameState: nextState, success: true, message: nextState.message }
}

export function declareConcealedKong(gameState, playerIndex, tileKey) {
  if (
    gameState.status !== 'playing' ||
    gameState.phase !== 'waitingDiscard' ||
    gameState.currentPlayer !== playerIndex
  ) {
    return { gameState, success: false, message: 'Concealed kong is not available' }
  }

  const matchingTiles = findTilesByKey(
    gameState.players[playerIndex].hand,
    tileKey,
  ).slice(0, 4)
  if (matchingTiles.length !== 4) {
    return { gameState, success: false, message: 'Four matching tiles are required' }
  }

  let nextState = cloneGameState(gameState)
  nextState.players[playerIndex].hand = removeTilesFromHand(
    nextState.players[playerIndex].hand,
    matchingTiles,
  )
  nextState = addMeldToPlayer(nextState, playerIndex, {
    type: 'kong',
    kongType: 'concealed',
    tiles: matchingTiles,
    fromPlayer: null,
    concealed: true,
  })
  nextState.kongDrawPending = {
    active: true,
    playerIndex,
    kongType: 'concealed',
  }
  nextState.robKongPhase = createEmptyRobKongPhase()
  nextState.phase = 'waitingKongDraw'
  nextState.canDeclareWin = false
  nextState.message = 'Concealed kong declared. Draw a replacement tile.'

  return { gameState: nextState, success: true, message: nextState.message }
}

export function canRobKong(hand, addedTile, melds = []) {
  return (
    Boolean(addedTile) &&
    canWinWithMelds(sortHand([...hand, addedTile]), melds)
  )
}

export function enterRobKongPhase(gameState, playerIndex, addedTile) {
  const nextState = cloneGameState(gameState)
  const canRobPlayers = nextState.players
    .filter(
      (player) =>
        player.id !== playerIndex &&
        canRobKong(player.hand, addedTile, player.melds),
    )
    .map((player) => player.id)

  nextState.robKongPhase = {
    active: canRobPlayers.length > 0,
    kongPlayer: playerIndex,
    addedTile,
    eligiblePlayers: [...canRobPlayers],
    passedPlayers: [],
    canRobPlayers: [...canRobPlayers],
  }

  if (canRobPlayers.length === 0) {
    return completeKong(nextState, playerIndex, 'added')
  }

  nextState.phase = 'robKong'
  nextState.canDeclareWin = false
  nextState.message = 'Players may rob the added kong.'
  return { gameState: nextState, success: true, message: nextState.message }
}

export function declareAddedKong(gameState, playerIndex, tileKey) {
  if (
    gameState.status !== 'playing' ||
    gameState.phase !== 'waitingDiscard' ||
    gameState.currentPlayer !== playerIndex
  ) {
    return { gameState, success: false, message: 'Added kong is not available' }
  }

  const option = getAvailableAddedKongs(gameState.players[playerIndex]).find(
    (candidate) => candidate.tileKey === tileKey,
  )
  if (!option) {
    return { gameState, success: false, message: 'Matching pong and tile are required' }
  }

  return enterRobKongPhase(gameState, playerIndex, option.tile)
}

export function robKongWin(gameState, winnerIndex) {
  if (
    !gameState.robKongPhase?.active ||
    !gameState.robKongPhase.canRobPlayers.includes(winnerIndex)
  ) {
    return { gameState, success: false, message: 'Rob kong win is not available' }
  }

  const nextState = cloneGameState(gameState)
  const player = nextState.players[winnerIndex]
  const winContext = {
    type: 'robKong',
    fromPlayer: nextState.robKongPhase.kongPlayer,
    winningTile: nextState.robKongPhase.addedTile,
    isKongDraw: false,
    isRobKong: true,
    isSelfDraw: false,
  }
  nextState.kongDrawPending = createEmptyKongDrawPending()
  nextState.robKongPhase = createEmptyRobKongPhase()
  return completeWin(nextState, player.id, winContext, 'Rob kong win.')
}

export function resolveRobKongPhase(gameState) {
  if (!gameState.robKongPhase?.active) {
    return { gameState, success: false, message: 'No active rob kong phase' }
  }

  return completeKong(
    gameState,
    gameState.robKongPhase.kongPlayer,
    'added',
  )
}

export function passRobKong(gameState, playerIndex) {
  if (
    !gameState.robKongPhase?.active ||
    !gameState.robKongPhase.eligiblePlayers.includes(playerIndex)
  ) {
    return { gameState, success: false, message: 'This player cannot pass' }
  }

  if (gameState.robKongPhase.passedPlayers.includes(playerIndex)) {
    return { gameState, success: false, message: 'Player already responded' }
  }

  const nextState = cloneGameState(gameState)
  nextState.robKongPhase.passedPlayers.push(playerIndex)
  const allPassed = nextState.robKongPhase.eligiblePlayers.every((eligiblePlayer) =>
    nextState.robKongPhase.passedPlayers.includes(eligiblePlayer),
  )

  if (allPassed) return resolveRobKongPhase(nextState)

  nextState.message = `${nextState.players[playerIndex].name} passed the rob kong opportunity.`
  return { gameState: nextState, success: true, message: nextState.message }
}

export function drawAfterKong(gameState) {
  const pending = gameState.kongDrawPending
  if (
    gameState.status !== 'playing' ||
    gameState.phase !== 'waitingKongDraw' ||
    !pending?.active ||
    gameState.currentPlayer !== pending.playerIndex
  ) {
    return { gameState, success: false, message: 'Replacement draw is not available' }
  }

  const drawResult = drawTileSkippingFlowers(
    gameState,
    gameState.currentPlayer,
  )
  if (!drawResult.success) {
    drawResult.gameState.canDeclareWin = false
    drawResult.gameState.kongDrawPending = createEmptyKongDrawPending()
    return drawResult
  }

  const nextState = drawResult.gameState
  const tile = drawResult.tile
  const player = nextState.players[nextState.currentPlayer]
  player.hand = sortHand(player.hand)
  nextState.phase = 'waitingDiscard'
  nextState.kongDrawPending = createEmptyKongDrawPending()
  nextState.canDeclareWin = canWinWithMelds(player.hand, player.melds)
  nextState.winContext = {
    type: 'kongDraw',
    fromPlayer: null,
    winningTile: tile,
    isKongDraw: true,
    isRobKong: false,
    isSelfDraw: true,
  }
  nextState.message = 'Replacement tile drawn. Please discard.'

  return { gameState: nextState, success: true, message: nextState.message }
}

export function resolveClaimPhase(gameState) {
  if (!gameState.claimPhase?.active) {
    return { gameState, success: false, message: 'No active claim phase' }
  }

  const nextState = cloneGameState(gameState)
  const discardedBy = nextState.claimPhase.discardedBy
  nextState.claimPhase = createEmptyClaimPhase()
  nextState.lastDiscard = { tile: null, fromPlayer: null }
  nextState.currentPlayer = getNextPlayerIndex(discardedBy)
  nextState.phase = 'waitingDraw'
  nextState.message = 'No claim. Next player draws.'

  return { gameState: nextState, success: true, message: nextState.message }
}

export function passClaim(gameState, playerIndex) {
  if (
    !gameState.claimPhase?.active ||
    !gameState.claimPhase.eligiblePlayers.includes(playerIndex)
  ) {
    return { gameState, success: false, message: 'This player cannot pass' }
  }

  const alreadyResponded = gameState.claimPhase.claims.some(
    (claim) => claim.playerIndex === playerIndex,
  )
  if (alreadyResponded) {
    return { gameState, success: false, message: 'Player already responded' }
  }

  const nextState = cloneGameState(gameState)
  nextState.claimPhase.claims.push({ playerIndex, type: 'pass' })
  const allResponded = nextState.claimPhase.eligiblePlayers.every((eligiblePlayer) =>
    nextState.claimPhase.claims.some(
      (claim) => claim.playerIndex === eligiblePlayer,
    ),
  )

  if (allResponded) return resolveClaimPhase(nextState)

  nextState.message = `${nextState.players[playerIndex].name} passed`
  return { gameState: nextState, success: true, message: nextState.message }
}

export function autoComputerClaim(gameState) {
  if (!gameState.claimPhase?.active) {
    return { gameState, success: false, message: 'No active claim phase' }
  }

  const humanIsEligible = gameState.claimPhase.eligiblePlayers.includes(0)
  const humanResponded = gameState.claimPhase.claims.some(
    (claim) => claim.playerIndex === 0,
  )
  if (humanIsEligible && !humanResponded) {
    return {
      gameState,
      success: false,
      message: 'Waiting for your claim decision',
    }
  }

  const computerPlayers = gameState.claimPhase.eligiblePlayers.filter(
    (playerIndex) =>
      !gameState.players[playerIndex].isHuman &&
      !gameState.claimPhase.claims.some(
        (claim) => claim.playerIndex === playerIndex,
      ),
  )
  const candidates = computerPlayers.map((playerIndex) => ({
    playerIndex,
    available: getAvailableClaims(gameState, playerIndex),
  }))

  const kongCandidate = candidates.find(
    ({ available }) => available.canKong && Math.random() < 0.2,
  )
  if (kongCandidate) {
    return claimDiscard(gameState, kongCandidate.playerIndex, 'kong')
  }

  const pongCandidate = candidates.find(
    ({ available }) => available.canPong && Math.random() < 0.3,
  )
  if (pongCandidate) {
    return claimDiscard(gameState, pongCandidate.playerIndex, 'pong')
  }

  const chiCandidate = candidates.find(
    ({ available }) => available.canChi && Math.random() < 0.2,
  )
  if (chiCandidate) {
    return claimDiscard(
      gameState,
      chiCandidate.playerIndex,
      'chi',
      chiCandidate.available.chiOptions[0],
    )
  }

  let nextState = gameState
  for (const playerIndex of computerPlayers) {
    const passResult = passClaim(nextState, playerIndex)
    nextState = passResult.gameState
    if (!nextState.claimPhase.active) return passResult
  }

  return {
    gameState: nextState,
    success: true,
    message: nextState.message,
  }
}

export function getComputerDiscardIndex(hand) {
  return hand.length > 0 ? hand.length - 1 : -1
}

export function runComputerTurn(gameState) {
  const player = gameState.players[gameState.currentPlayer]

  if (
    gameState.status !== 'playing' ||
    !player ||
    player.isHuman
  ) {
    return {
      gameState,
      success: false,
      message: player?.isHuman ? 'Waiting for the human player' : 'Game is over',
    }
  }

  let currentState = gameState
  if (currentState.phase === 'waitingKongDraw') {
    const replacementResult = drawAfterKong(currentState)
    currentState = replacementResult.gameState
    if (
      !replacementResult.success ||
      currentState.status !== 'playing'
    ) {
      return replacementResult
    }
  }

  if (currentState.phase === 'waitingDraw') {
    const drawResult = drawTile(currentState)
    currentState = drawResult.gameState
    if (currentState.status !== 'playing') return drawResult
  }

  const computer = currentState.players[currentState.currentPlayer]
  if (canWinWithMelds(computer.hand, computer.melds)) {
    return completeWin(
      currentState,
      computer.id,
      currentState.winContext ?? {
        type: 'selfDraw',
        fromPlayer: null,
        winningTile: null,
        isKongDraw: false,
        isRobKong: false,
        isSelfDraw: true,
      },
    )
  }

  return discardTile(
    currentState,
    currentState.currentPlayer,
    getComputerDiscardIndex(computer.hand),
  )
}

export function advanceTurn(gameState) {
  if (gameState.status !== 'playing') {
    return { gameState, success: false, message: 'Game is over' }
  }

  if (gameState.claimPhase?.active || gameState.phase === 'claim') {
    return autoComputerClaim(gameState)
  }

  if (gameState.robKongPhase?.active || gameState.phase === 'robKong') {
    const humanCanRob =
      gameState.robKongPhase.eligiblePlayers.includes(0) &&
      !gameState.robKongPhase.passedPlayers.includes(0)
    if (humanCanRob) {
      return {
        gameState,
        success: false,
        message: 'Waiting for your rob kong decision',
      }
    }

    const computerWinner = gameState.robKongPhase.canRobPlayers.find(
      (playerIndex) =>
        !gameState.players[playerIndex].isHuman &&
        !gameState.robKongPhase.passedPlayers.includes(playerIndex),
    )
    if (computerWinner !== undefined) {
      return robKongWin(gameState, computerWinner)
    }

    return resolveRobKongPhase(gameState)
  }

  const player = gameState.players[gameState.currentPlayer]
  if (player.isHuman) {
    return {
      gameState,
      success: false,
      message: 'Waiting for your move',
    }
  }

  return runComputerTurn(gameState)
}

function canFormMelds(counts, requiredSets) {
  if (requiredSets === 0) {
    return counts.every((count) => count === 0)
  }

  const firstIndex = counts.findIndex((count) => count > 0)
  if (firstIndex === -1) return false

  if (counts[firstIndex] >= 3) {
    counts[firstIndex] -= 3
    if (canFormMelds(counts, requiredSets - 1)) {
      counts[firstIndex] += 3
      return true
    }
    counts[firstIndex] += 3
  }

  const rankIndex = firstIndex % 9
  if (
    firstIndex < 27 &&
    rankIndex <= 6 &&
    counts[firstIndex + 1] > 0 &&
    counts[firstIndex + 2] > 0
  ) {
    counts[firstIndex] -= 1
    counts[firstIndex + 1] -= 1
    counts[firstIndex + 2] -= 1
    if (canFormMelds(counts, requiredSets - 1)) {
      counts[firstIndex] += 1
      counts[firstIndex + 1] += 1
      counts[firstIndex + 2] += 1
      return true
    }
    counts[firstIndex] += 1
    counts[firstIndex + 1] += 1
    counts[firstIndex + 2] += 1
  }

  return false
}

export function isValidMeld(meld) {
  if (!meld || !Array.isArray(meld.tiles)) return false
  const hasValidTiles = meld.tiles.every(isValidTile)
  if (!hasValidTiles) return false

  if (meld.type === 'chi') {
    if (meld.tiles.length !== 3) return false
    const sortedTiles = sortHand(meld.tiles)
    return (
      sortedTiles.every(
        (tile) =>
          tile.suit === sortedTiles[0].suit &&
          NUMBERED_SUITS.includes(tile.suit),
      ) &&
      sortedTiles[1].rank === sortedTiles[0].rank + 1 &&
      sortedTiles[2].rank === sortedTiles[1].rank + 1
    )
  }

  if (meld.type === 'pong') {
    return (
      meld.tiles.length === 3 &&
      meld.tiles.every((tile) => isSameTile(tile, meld.tiles[0]))
    )
  }

  if (meld.type === 'kong') {
    return (
      meld.tiles.length === 4 &&
      meld.tiles.every((tile) => isSameTile(tile, meld.tiles[0]))
    )
  }

  return false
}

export function countCompletedMelds(melds = []) {
  return melds.filter(isValidMeld).length
}

function isValidTile(tile) {
  if (!tile || !MAHJONG_SUITS.includes(tile.suit)) return false
  if (tile.suit === 'flower') return false
  if (NUMBERED_SUITS.includes(tile.suit)) {
    return Number.isInteger(tile.rank) && tile.rank >= 1 && tile.rank <= 9
  }
  if (tile.suit === 'wind') return WIND_RANKS.includes(tile.rank)
  return DRAGON_RANKS.includes(tile.rank)
}

function getTileIndex(tile) {
  if (!isValidTile(tile)) return -1
  if (NUMBERED_SUITS.includes(tile.suit)) {
    return NUMBERED_SUITS.indexOf(tile.suit) * 9 + tile.rank - 1
  }
  if (tile.suit === 'wind') return 27 + WIND_RANKS.indexOf(tile.rank)
  return 31 + DRAGON_RANKS.indexOf(tile.rank)
}

export function canFormRequiredSetsAndPair(hand, requiredSets) {
  if (
    !Number.isInteger(requiredSets) ||
    requiredSets < 0 ||
    hand.length !== requiredSets * 3 + 2
  ) {
    return false
  }

  const counts = Array(34).fill(0)
  for (const tile of hand) {
    const tileIndex = getTileIndex(tile)
    if (tileIndex === -1) return false
    counts[tileIndex] += 1
  }

  for (let index = 0; index < counts.length; index += 1) {
    if (counts[index] < 2) continue
    counts[index] -= 2
    if (canFormMelds(counts, requiredSets)) {
      counts[index] += 2
      return true
    }
    counts[index] += 2
  }

  return false
}

export function isValidWinningHandWithMelds(hand, melds = []) {
  const requiredSets = 5 - countCompletedMelds(melds)
  if (requiredSets < 0) return false
  return canFormRequiredSetsAndPair(hand, requiredSets)
}

export function canWinWithMelds(hand, melds = []) {
  return isValidWinningHandWithMelds(hand, melds)
}

export function isValidWinningHand(hand) {
  return isValidWinningHandWithMelds(hand, [])
}

export function canWin(hand) {
  return canWinWithMelds(hand, [])
}

function completeWin(gameState, playerIndex, winContext, messagePrefix = '') {
  const nextState = cloneGameState(gameState)
  const player = nextState.players[playerIndex]
  nextState.status = 'win'
  nextState.winner = {
    id: player.id,
    name: player.name,
    seat: player.seat,
  }
  nextState.canDeclareWin = false
  nextState.winContext = { ...winContext }
  nextState.scoringResult = calculatePayments(
    nextState,
    playerIndex,
    nextState.winContext,
    nextState.scoringMode ?? SCORING_MODES.SIMPLE,
  )
  nextState.message = `${messagePrefix ? `${messagePrefix} ` : ''}${player.name} wins.`

  return { gameState: nextState, success: true, message: nextState.message }
}

export function declareWin(gameState, playerIndex) {
  if (
    gameState.status !== 'playing' ||
    playerIndex !== gameState.currentPlayer ||
    !canWinWithMelds(
      gameState.players[playerIndex].hand,
      gameState.players[playerIndex].melds,
    )
  ) {
    return { gameState, success: false, message: 'This hand cannot win' }
  }

  return completeWin(
    gameState,
    playerIndex,
    gameState.winContext ?? {
      type: 'selfDraw',
      fromPlayer: null,
      winningTile: null,
      isKongDraw: false,
      isRobKong: false,
      isSelfDraw: true,
    },
  )
}

export function calculateMahjongScore(gameState, winnerIndex) {
  return gameState.status === 'win' && winnerIndex === 0 ? 100 : 0
}
