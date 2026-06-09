export const SYMBOLS = [
  { id: 'cherry', label: '🍒', weight: 30, payout: 2 },
  { id: 'lemon', label: '🍋', weight: 25, payout: 3 },
  { id: 'bell', label: '🔔', weight: 20, payout: 5 },
  { id: 'star', label: '⭐', weight: 15, payout: 8 },
  { id: 'diamond', label: '💎', weight: 8, payout: 15 },
  { id: 'seven', label: '7️⃣', weight: 2, payout: 30 },
]

export function createInitialSlotGame() {
  return {
    reels: [SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]],
    credits: 100,
    bet: 10,
    lastWin: 0,
    totalSpins: 0,
    bestWin: 0,
    status: 'ready',
    message: 'Press Spin to play',
  }
}

export function getWeightedRandomSymbol(randomFn = Math.random) {
  const totalWeight = SYMBOLS.reduce((total, symbol) => total + symbol.weight, 0)
  const randomValue = Math.min(0.999999, Math.max(0, randomFn()))
  let threshold = randomValue * totalWeight

  for (const symbol of SYMBOLS) {
    threshold -= symbol.weight
    if (threshold < 0) return symbol
  }

  return SYMBOLS[SYMBOLS.length - 1]
}

export function spinReels(randomFn = Math.random) {
  return Array.from({ length: 3 }, () => getWeightedRandomSymbol(randomFn))
}

export function calculatePayout(reels, bet) {
  if (!Array.isArray(reels) || reels.length !== 3 || bet <= 0) return 0

  const counts = reels.reduce((result, symbol) => {
    result[symbol.id] = (result[symbol.id] || 0) + 1
    return result
  }, {})
  const matchingEntry = Object.entries(counts).find(([, count]) => count >= 2)

  if (matchingEntry?.[1] === 3) {
    const symbol = reels.find((reel) => reel.id === matchingEntry[0])
    return symbol.payout * bet
  }

  if (matchingEntry?.[1] === 2) {
    const symbol = reels.find((reel) => reel.id === matchingEntry[0])
    return Math.floor(symbol.payout * bet * 0.3)
  }

  return reels.some((symbol) => symbol.id === 'cherry') ? bet : 0
}

export function canSpin(gameState) {
  return (
    gameState.status !== 'spinning' &&
    gameState.credits > 0 &&
    gameState.bet >= 5 &&
    gameState.bet <= 50 &&
    gameState.bet <= gameState.credits
  )
}

export function updateBestResult(gameState) {
  return {
    ...gameState,
    bestWin: Math.max(gameState.bestWin || 0, gameState.lastWin || 0),
  }
}

export function spin(gameState, randomFn = Math.random) {
  if (!canSpin(gameState)) {
    const outOfCredits = gameState.credits <= 0
    return {
      ...gameState,
      status: outOfCredits ? 'gameOver' : gameState.status,
      message: outOfCredits
        ? 'Out of credits. Reset the game to play again.'
        : 'Not enough credits for this bet.',
    }
  }

  const reels = spinReels(randomFn)
  const payout = calculatePayout(reels, gameState.bet)
  const credits = gameState.credits - gameState.bet + payout
  const result = updateBestResult({
    ...gameState,
    reels,
    credits,
    bet: credits > 0 ? Math.min(gameState.bet, credits) : 0,
    lastWin: payout,
    totalSpins: gameState.totalSpins + 1,
    status: credits === 0 ? 'gameOver' : 'result',
    message:
      credits === 0
        ? 'Out of credits. Reset the game to play again.'
        : payout > 0
          ? `You won ${payout} credits!`
          : 'No match. Spin again.',
  })

  return result
}

export function resetSlotGame() {
  return createInitialSlotGame()
}
