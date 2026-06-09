export const NUMBER_SUITS = ['characters', 'dots', 'bamboo']

// Simplified values used by both scoring modes. Different house rules may vary.
export const HAND_PATTERN_RULES = {
  pinfu: 2,
  allPongs: 4,
  halfFlush: 4,
  fullFlush: 8,
}

export function getHandTiles(player) {
  return [...(player?.hand ?? [])].filter((tile) => tile.suit !== 'flower')
}

export function getMeldTiles(player) {
  return (player?.melds ?? []).flatMap((meld) =>
    [...(meld.tiles ?? [])].filter((tile) => tile.suit !== 'flower'),
  )
}

export function getAllTilesForPattern(player) {
  return [...getHandTiles(player), ...getMeldTiles(player)]
}

export function getTileSuit(tile) {
  return tile?.suit ?? null
}

export function isNumberSuit(tile) {
  return NUMBER_SUITS.includes(getTileSuit(tile))
}

export function isHonorTile(tile) {
  return isWindTile(tile) || isDragonTile(tile)
}

export function isDragonTile(tile) {
  return getTileSuit(tile) === 'dragon'
}

export function isWindTile(tile) {
  return getTileSuit(tile) === 'wind'
}

export function groupTilesByKey(tiles) {
  const groups = new Map()

  for (const tile of tiles ?? []) {
    const key = `${tile.suit}-${tile.rank}`
    groups.set(key, [...(groups.get(key) ?? []), tile])
  }

  return groups
}

export function getTripletGroupsFromMelds(player) {
  return (player?.melds ?? []).filter(
    (meld) =>
      (meld.type === 'pong' || meld.type === 'kong') &&
      (meld.tiles?.length === 3 || meld.tiles?.length === 4),
  )
}

export function getSequenceGroupsFromMelds(player) {
  return (player?.melds ?? []).filter(
    (meld) => meld.type === 'chi' && meld.tiles?.length === 3,
  )
}

export function getSuitSummary(player) {
  const tiles = getAllTilesForPattern(player)
  const numberedSuits = new Set(
    tiles.filter(isNumberSuit).map(getTileSuit),
  )
  const honorTiles = tiles.filter(isHonorTile)

  return {
    tiles,
    numberedSuits,
    honorTiles,
    hasHonors: honorTiles.length > 0,
  }
}

export function getTileIndex(tile) {
  if (isNumberSuit(tile)) {
    if (!Number.isInteger(tile.rank) || tile.rank < 1 || tile.rank > 9) {
      return -1
    }
    return NUMBER_SUITS.indexOf(tile.suit) * 9 + tile.rank - 1
  }
  if (isWindTile(tile)) {
    return 27 + ['east', 'south', 'west', 'north'].indexOf(tile.rank)
  }
  if (isDragonTile(tile)) {
    return 31 + ['red', 'green', 'white'].indexOf(tile.rank)
  }
  return -1
}

export function createTileCounts(tiles) {
  const counts = Array(34).fill(0)

  for (const tile of tiles ?? []) {
    const index = getTileIndex(tile)
    if (index < 0) return null
    counts[index] += 1
  }

  return counts
}
