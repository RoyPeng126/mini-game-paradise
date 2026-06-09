import {
  HAND_PATTERN_RULES,
  createTileCounts,
  getHandTiles,
} from './patternUtils.js'

function canFormTriplets(counts, requiredTriplets) {
  if (requiredTriplets === 0) {
    return counts.every((count) => count === 0)
  }

  const firstIndex = counts.findIndex((count) => count > 0)
  if (firstIndex === -1 || counts[firstIndex] < 3) return false

  counts[firstIndex] -= 3
  const valid = canFormTriplets(counts, requiredTriplets - 1)
  counts[firstIndex] += 3
  return valid
}

function canFormSequences(counts, requiredSequences) {
  if (requiredSequences === 0) {
    return counts.every((count) => count === 0)
  }

  const firstIndex = counts.findIndex((count) => count > 0)
  const rankIndex = firstIndex % 9
  if (
    firstIndex < 0 ||
    firstIndex >= 27 ||
    rankIndex > 6 ||
    counts[firstIndex + 1] === 0 ||
    counts[firstIndex + 2] === 0
  ) {
    return false
  }

  counts[firstIndex] -= 1
  counts[firstIndex + 1] -= 1
  counts[firstIndex + 2] -= 1
  const valid = canFormSequences(counts, requiredSequences - 1)
  counts[firstIndex] += 1
  counts[firstIndex + 1] += 1
  counts[firstIndex + 2] += 1
  return valid
}

function canFormSetsAndPair(hand, requiredSets, setMatcher) {
  if (hand.length !== requiredSets * 3 + 2) return false
  const counts = createTileCounts(hand)
  if (!counts) return false

  for (let index = 0; index < counts.length; index += 1) {
    if (counts[index] < 2) continue
    counts[index] -= 2
    if (setMatcher(counts, requiredSets)) {
      counts[index] += 2
      return true
    }
    counts[index] += 2
  }

  return false
}

export function isAllPongs(player) {
  const melds = player?.melds ?? []
  if (melds.some((meld) => meld.type === 'chi')) return false
  if (melds.some((meld) => !['pong', 'kong'].includes(meld.type))) return false

  const requiredTriplets = 5 - melds.length
  return (
    requiredTriplets >= 0 &&
    canFormSetsAndPair(
      getHandTiles(player),
      requiredTriplets,
      canFormTriplets,
    )
  )
}

export function isPinfu(player, winningBreakdown = null) {
  void winningBreakdown
  const melds = player?.melds ?? []
  if (melds.some((meld) => meld.type === 'pong' || meld.type === 'kong')) {
    return false
  }
  if (melds.some((meld) => meld.type !== 'chi')) return false

  const requiredSequences = 5 - melds.length
  return (
    requiredSequences >= 0 &&
    canFormSetsAndPair(
      getHandTiles(player),
      requiredSequences,
      canFormSequences,
    )
  )
}

export function detectBasicPatterns(
  gameState,
  winnerIndex,
  winContext = {},
  mode,
) {
  void winContext
  void mode
  const player = gameState.players[winnerIndex]
  const patterns = []

  if (isPinfu(player)) {
    patterns.push({
      key: 'pinfu',
      name: 'Pinfu',
      tai: HAND_PATTERN_RULES.pinfu,
    })
  }
  if (isAllPongs(player)) {
    patterns.push({
      key: 'allPongs',
      name: 'All Pongs',
      tai: HAND_PATTERN_RULES.allPongs,
    })
  }

  return patterns
}
