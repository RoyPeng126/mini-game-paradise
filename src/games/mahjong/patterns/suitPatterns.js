import {
  HAND_PATTERN_RULES,
  getSuitSummary,
} from './patternUtils.js'

export function isFullFlush(player) {
  const summary = getSuitSummary(player)
  return (
    summary.tiles.length > 0 &&
    summary.numberedSuits.size === 1 &&
    !summary.hasHonors
  )
}

export function isHalfFlush(player) {
  const summary = getSuitSummary(player)
  return summary.numberedSuits.size === 1 && summary.hasHonors
}

export function detectSuitPatterns(
  gameState,
  winnerIndex,
  winContext = {},
  mode,
) {
  void winContext
  void mode
  const player = gameState.players[winnerIndex]

  if (isFullFlush(player)) {
    return [{
      key: 'fullFlush',
      name: 'Full Flush',
      tai: HAND_PATTERN_RULES.fullFlush,
    }]
  }
  if (isHalfFlush(player)) {
    return [{
      key: 'halfFlush',
      name: 'Half Flush',
      tai: HAND_PATTERN_RULES.halfFlush,
    }]
  }
  return []
}
