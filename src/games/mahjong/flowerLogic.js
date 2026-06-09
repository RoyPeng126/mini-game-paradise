const FLOWER_SEATS = {
  spring: 0,
  plum: 0,
  summer: 1,
  orchid: 1,
  autumn: 2,
  bamboo: 2,
  winter: 3,
  chrysanthemum: 3,
}

const SEAT_INDEXES = {
  East: 0,
  South: 1,
  West: 2,
  North: 3,
}

function cloneFlowerState(gameState) {
  return {
    ...gameState,
    wall: [...gameState.wall],
    players: gameState.players.map((player) => ({
      ...player,
      hand: [...player.hand],
      flowerTiles: [...(player.flowerTiles ?? [])],
    })),
  }
}

export function isFlowerTile(tile) {
  return tile?.suit === 'flower'
}

export function getFlowerSeat(tile) {
  return isFlowerTile(tile) ? (FLOWER_SEATS[tile.rank] ?? null) : null
}

export function isSeatFlower(tile, playerIndex, gameState = null) {
  const playerSeat = gameState?.players?.[playerIndex]?.seat
  const seatIndex = playerSeat ? SEAT_INDEXES[playerSeat] : playerIndex
  return getFlowerSeat(tile) === seatIndex
}

export function addFlowerToPlayer(player, tile) {
  return {
    ...player,
    flowerTiles: [...(player.flowerTiles ?? []), tile],
  }
}

export function extractFlowersFromHand(player, wall) {
  let nextPlayer = {
    ...player,
    hand: player.hand.filter((tile) => !isFlowerTile(tile)),
    flowerTiles: [...(player.flowerTiles ?? [])],
  }
  const nextWall = [...wall]
  let replacementsNeeded = player.hand.length - nextPlayer.hand.length

  for (const flower of player.hand.filter(isFlowerTile)) {
    nextPlayer = addFlowerToPlayer(nextPlayer, flower)
  }

  while (replacementsNeeded > 0 && nextWall.length > 0) {
    const replacement = nextWall.shift()
    if (isFlowerTile(replacement)) {
      nextPlayer = addFlowerToPlayer(nextPlayer, replacement)
    } else {
      nextPlayer.hand.push(replacement)
      replacementsNeeded -= 1
    }
  }

  return {
    player: nextPlayer,
    wall: nextWall,
    exhausted: replacementsNeeded > 0,
  }
}

export function resolveFlowersForPlayer(gameState, playerIndex) {
  const nextState = cloneFlowerState(gameState)
  const player = nextState.players[playerIndex]
  if (!player) return nextState

  const result = extractFlowersFromHand(player, nextState.wall)
  nextState.players[playerIndex] = result.player
  nextState.wall = result.wall

  if (result.exhausted) {
    nextState.status = 'draw'
    nextState.message = 'Wall is empty while replacing flowers.'
  }

  return nextState
}

export function resolveInitialFlowers(gameState) {
  let nextState = cloneFlowerState(gameState)

  for (let playerIndex = 0; playerIndex < nextState.players.length; playerIndex += 1) {
    nextState = resolveFlowersForPlayer(nextState, playerIndex)
    if (nextState.status === 'draw') break
  }

  return nextState
}

export function drawTileSkippingFlowers(gameState, playerIndex) {
  let nextState = cloneFlowerState(gameState)
  let player = nextState.players[playerIndex]

  if (!player) {
    return {
      gameState,
      tile: null,
      success: false,
      message: 'Player not found.',
    }
  }

  while (nextState.wall.length > 0) {
    const tile = nextState.wall.shift()
    if (isFlowerTile(tile)) {
      player = addFlowerToPlayer(player, tile)
      nextState.players[playerIndex] = player
      continue
    }

    player.hand.push(tile)
    nextState.players[playerIndex] = player
    return {
      gameState: nextState,
      tile,
      success: true,
      message: `${player.name} drew a tile`,
    }
  }

  nextState.status = 'draw'
  nextState.message = 'Wall is empty. Game ended in draw.'
  return {
    gameState: nextState,
    tile: null,
    success: false,
    message: nextState.message,
  }
}
