import { isSeatFlower } from './flowerLogic.js'
import { detectBasicPatterns } from './patterns/basicPatterns.js'
import {
  HAND_PATTERN_RULES,
} from './patterns/patternUtils.js'
import { detectSuitPatterns } from './patterns/suitPatterns.js'

export const SCORING_MODES = {
  SIMPLE: 'simple',
  TAIWAN_COMMON: 'taiwanCommon',
}

export const SCORING_RULES_SIMPLE = {
  selfDraw: 1,
  menqing: 1,
  menqingSelfDraw: 3,
  robKong: 1,
  kongDraw: 1,
  dealerWin: 1,
  dragonPong: 1,
  seatWindPong: 1,
  prevailingWindPong: 1,
  flower: 1,
  seatFlower: 1,
  allFlowers: 8,
  ...HAND_PATTERN_RULES,
}

export const SCORING_RULES_TAIWAN_COMMON = {
  selfDraw: 1,
  menqing: 1,
  menqingSelfDraw: 3,
  robKong: 1,
  kongDraw: 1,
  dealerWin: 1,
  dragonPong: 1,
  seatWindPong: 1,
  prevailingWindPong: 1,
  seatFlower: 1,
  seasonSet: 2,
  nobleSet: 2,
  allFlowers: 8,
  ...HAND_PATTERN_RULES,
}

// Backward-compatible alias for the original simple rules.
export const SCORING_RULES = SCORING_RULES_SIMPLE

const SEASON_FLOWERS = ['spring', 'summer', 'autumn', 'winter']
const NOBLE_FLOWERS = ['plum', 'orchid', 'bamboo', 'chrysanthemum']

const PATTERN_NAMES = {
  selfDraw: 'Self Draw',
  menqing: 'Menqing',
  menqingSelfDraw: 'Menqing Self Draw',
  robKong: 'Rob Kong',
  kongDraw: 'Kong Draw',
  dealerWin: 'Dealer Win',
  dragonPong: 'Dragon Pong',
  seatWindPong: 'Seat Wind Pong',
  prevailingWindPong: 'Prevailing Wind Pong',
  flower: 'Flowers',
  seatFlower: 'Seat Flowers',
  seasonSet: 'Season Flower Set',
  nobleSet: 'Noble Flower Set',
  allFlowers: 'All Flowers',
}

function getRules(mode) {
  return mode === SCORING_MODES.TAIWAN_COMMON
    ? SCORING_RULES_TAIWAN_COMMON
    : SCORING_RULES_SIMPLE
}

export function isMenqing(player) {
  return (player?.melds ?? []).every(
    (meld) =>
      meld.type === 'kong' &&
      (meld.kongType === 'concealed' || meld.concealed === true),
  )
}

export function isSelfDraw(winContext = {}) {
  return winContext.type === 'selfDraw' || winContext.isSelfDraw === true
}

export function isRobKong(winContext = {}) {
  return winContext.type === 'robKong' || winContext.isRobKong === true
}

export function isKongDraw(winContext = {}) {
  return winContext.type === 'kongDraw' || winContext.isKongDraw === true
}

export function isDealer(gameState, playerIndex) {
  return gameState?.dealer === playerIndex
}

export function getTripletLikeGroups(player) {
  const groups = []
  const handCounts = new Map()

  for (const tile of player?.hand ?? []) {
    const key = `${tile.suit}-${tile.rank}`
    const entry = handCounts.get(key) ?? {
      suit: tile.suit,
      rank: tile.rank,
      count: 0,
    }
    entry.count += 1
    handCounts.set(key, entry)
  }

  for (const entry of handCounts.values()) {
    if (entry.count >= 3) groups.push({ ...entry, source: 'hand' })
  }

  for (const meld of player?.melds ?? []) {
    if (
      (meld.type === 'pong' || meld.type === 'kong') &&
      meld.tiles?.length > 0
    ) {
      groups.push({
        suit: meld.tiles[0].suit,
        rank: meld.tiles[0].rank,
        count: meld.tiles.length,
        source: 'meld',
      })
    }
  }

  return groups
}

export function hasTripletOf(player, suit, rank) {
  return getTripletLikeGroups(player).some(
    (group) => group.suit === suit && group.rank === rank,
  )
}

export function getSeatWindRank(playerIndex, gameState = null) {
  const seat = gameState?.players?.[playerIndex]?.seat
  return seat
    ? seat.toLowerCase()
    : ['east', 'south', 'west', 'north'][playerIndex] ?? null
}

export function getPrevailingWindRank(gameState) {
  return gameState?.prevailingWind ?? 'east'
}

function createPattern(key, multiplier = 1, mode = SCORING_MODES.SIMPLE) {
  const rules = getRules(mode)
  return {
    key,
    name: PATTERN_NAMES[key],
    tai: rules[key] * multiplier,
  }
}

export function hasSeasonSet(player) {
  const ranks = new Set(
    (player?.flowerTiles ?? []).map((tile) => tile.rank),
  )
  return SEASON_FLOWERS.every((rank) => ranks.has(rank))
}

export function hasNobleSet(player) {
  const ranks = new Set(
    (player?.flowerTiles ?? []).map((tile) => tile.rank),
  )
  return NOBLE_FLOWERS.every((rank) => ranks.has(rank))
}

export function countSeatFlowers(player, gameState) {
  return (player?.flowerTiles ?? []).filter((tile) =>
    isSeatFlower(tile, player.id, gameState),
  ).length
}

export function getFlowerPatterns(
  player,
  gameState,
  mode = SCORING_MODES.SIMPLE,
) {
  const patterns = []
  const flowerTiles = player?.flowerTiles ?? []
  const seatFlowerCount = countSeatFlowers(player, gameState)

  if (mode === SCORING_MODES.TAIWAN_COMMON) {
    if (seatFlowerCount > 0) {
      patterns.push(createPattern('seatFlower', seatFlowerCount, mode))
    }
    if (hasSeasonSet(player)) {
      patterns.push(createPattern('seasonSet', 1, mode))
    }
    if (hasNobleSet(player)) {
      patterns.push(createPattern('nobleSet', 1, mode))
    }
  } else {
    if (flowerTiles.length > 0) {
      patterns.push(createPattern('flower', flowerTiles.length, mode))
    }
    if (seatFlowerCount > 0) {
      patterns.push(createPattern('seatFlower', seatFlowerCount, mode))
    }
  }

  if (flowerTiles.length === 8) {
    patterns.push(createPattern('allFlowers', 1, mode))
  }

  return patterns
}

export function detectPatterns(
  gameState,
  winnerIndex,
  winContext = {},
  mode = SCORING_MODES.SIMPLE,
) {
  const player = gameState.players[winnerIndex]
  const patterns = []
  const selfDraw = isSelfDraw(winContext)
  const menqing = isMenqing(player)
  const tripletGroups = getTripletLikeGroups(player)
  const dragonPongCount = tripletGroups.filter(
    (group) => group.suit === 'dragon',
  ).length

  if (selfDraw) patterns.push(createPattern('selfDraw', 1, mode))
  if (menqing) patterns.push(createPattern('menqing', 1, mode))
  // This simplified model stacks menqing, self draw, and menqing self draw.
  // Regional and house rules may treat some of these patterns as mutually exclusive.
  if (menqing && selfDraw) {
    patterns.push(createPattern('menqingSelfDraw', 1, mode))
  }
  if (isRobKong(winContext)) patterns.push(createPattern('robKong', 1, mode))
  if (isKongDraw(winContext)) patterns.push(createPattern('kongDraw', 1, mode))
  if (isDealer(gameState, winnerIndex)) {
    patterns.push(createPattern('dealerWin', 1, mode))
  }
  if (dragonPongCount > 0) {
    patterns.push(createPattern('dragonPong', dragonPongCount, mode))
  }
  if (hasTripletOf(player, 'wind', getSeatWindRank(winnerIndex, gameState))) {
    patterns.push(createPattern('seatWindPong', 1, mode))
  }
  if (hasTripletOf(player, 'wind', getPrevailingWindRank(gameState))) {
    patterns.push(createPattern('prevailingWindPong', 1, mode))
  }
  patterns.push(...getFlowerPatterns(player, gameState, mode))
  patterns.push(...detectBasicPatterns(gameState, winnerIndex, winContext, mode))
  patterns.push(...detectSuitPatterns(gameState, winnerIndex, winContext, mode))

  return {
    mode,
    patterns,
    totalTai: patterns.reduce((total, pattern) => total + pattern.tai, 0),
  }
}

export function calculateTai(
  gameState,
  winnerIndex,
  winContext = {},
  mode = SCORING_MODES.SIMPLE,
) {
  const result = detectPatterns(gameState, winnerIndex, winContext, mode)
  return {
    mode,
    winnerIndex,
    totalTai: result.totalTai,
    patterns: result.patterns,
  }
}

export function calculatePayments(
  gameState,
  winnerIndex,
  winContext = {},
  mode = SCORING_MODES.SIMPLE,
) {
  const taiResult = calculateTai(gameState, winnerIndex, winContext, mode)
  const totalTai = Math.max(1, taiResult.totalTai)
  const points = 10 * totalTai
  const playerCount = gameState.players.length
  const payments = gameState.players.map((_, playerIndex) => ({
    playerIndex,
    delta: 0,
  }))
  const paysAsSelfDraw = isSelfDraw(winContext) || isKongDraw(winContext)

  if (paysAsSelfDraw) {
    for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
      if (playerIndex === winnerIndex) continue
      payments[playerIndex].delta = -points
      payments[winnerIndex].delta += points
    }
  } else {
    const payerIndex = winContext.fromPlayer
    if (
      Number.isInteger(payerIndex) &&
      payerIndex >= 0 &&
      payerIndex < playerCount &&
      payerIndex !== winnerIndex
    ) {
      payments[payerIndex].delta = -(points * (playerCount - 1))
      payments[winnerIndex].delta = points * (playerCount - 1)
    }
  }

  return {
    mode,
    winnerIndex,
    totalTai,
    points,
    payments,
    patterns: taiResult.patterns,
  }
}
