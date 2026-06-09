import { createDeck, drawCard, shuffleDeck } from '../shared/cardUtils.js'

const RANK_VALUES = {
  A: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
}

const RED_SUITS = new Set(['hearts', 'diamonds'])

function success(gameState, message) {
  return { gameState, moved: true, message }
}

function failure(gameState, message = 'Invalid move') {
  return { gameState, moved: false, message }
}

function clonePiles(gameState) {
  return {
    stock: [...gameState.stock],
    waste: [...gameState.waste],
    foundations: gameState.foundations.map((pile) => [...pile]),
    tableau: gameState.tableau.map((pile) => [...pile]),
  }
}

function isOppositeColor(firstCard, secondCard) {
  return RED_SUITS.has(firstCard.suit) !== RED_SUITS.has(secondCard.suit)
}

function isValidFaceUpSequence(cards) {
  if (cards.length === 0 || cards.some((card) => !card.faceUp)) return false

  return cards.every((card, index) => {
    if (index === cards.length - 1) return true
    const nextCard = cards[index + 1]
    return (
      isOppositeColor(card, nextCard) &&
      RANK_VALUES[card.rank] === RANK_VALUES[nextCard.rank] + 1
    )
  })
}

function finalizeMove(gameState, message, scoreGained = 0) {
  const wonBeforeMove = Boolean(gameState.won)
  const nextState = {
    ...gameState,
    moves: gameState.moves + 1,
    score: Math.max(0, gameState.score + scoreGained),
  }
  const won = checkWin(nextState)

  return success(
    {
      ...nextState,
      won,
      score: nextState.score + (won && !wonBeforeMove ? 100 : 0),
    },
    won ? 'You win! Bonus +100' : message,
  )
}

function revealTopCard(tableau, tableauIndex) {
  const pile = tableau[tableauIndex]
  const topCard = pile[pile.length - 1]

  if (!topCard || topCard.faceUp) {
    return { tableau, flipped: false }
  }

  const nextTableau = tableau.map((column, index) =>
    index === tableauIndex
      ? column.map((card, cardIndex) =>
          cardIndex === column.length - 1 ? { ...card, faceUp: true } : card,
        )
      : column,
  )

  return { tableau: nextTableau, flipped: true }
}

export function createInitialSolitaireGame(deck = shuffleDeck(createDeck())) {
  let remainingDeck = deck.map((card) => ({ ...card, faceUp: false }))
  const tableau = []

  for (let columnIndex = 0; columnIndex < 7; columnIndex += 1) {
    const column = []

    for (let cardIndex = 0; cardIndex <= columnIndex; cardIndex += 1) {
      const draw = drawCard(remainingDeck)
      if (draw.card) {
        column.push({
          ...draw.card,
          faceUp: cardIndex === columnIndex,
        })
      }
      remainingDeck = draw.remainingDeck
    }

    tableau.push(column)
  }

  return {
    stock: remainingDeck.map((card) => ({ ...card, faceUp: false })),
    waste: [],
    foundations: Array.from({ length: 4 }, () => []),
    tableau,
    moves: 0,
    score: 0,
    won: false,
  }
}

export function drawFromStock(gameState) {
  if (gameState.won) return failure(gameState, 'Start a new game to play again')

  if (gameState.stock.length > 0) {
    const { card, remainingDeck } = drawCard(gameState.stock)
    const nextState = {
      ...gameState,
      stock: remainingDeck,
      waste: [...gameState.waste, { ...card, faceUp: true }],
    }
    return finalizeMove(nextState, 'Drew a card from stock')
  }

  if (gameState.waste.length === 0) {
    return failure(gameState, 'Stock and waste are empty')
  }

  const nextState = {
    ...gameState,
    stock: [...gameState.waste]
      .reverse()
      .map((card) => ({ ...card, faceUp: false })),
    waste: [],
  }
  return finalizeMove(nextState, 'Stock reset · -20', -20)
}

export function canMoveToFoundation(card, foundationPile) {
  if (!card?.faceUp) return false
  if (foundationPile.length === 0) return card.rank === 'A'

  const topCard = foundationPile[foundationPile.length - 1]
  return (
    topCard.suit === card.suit &&
    RANK_VALUES[card.rank] === RANK_VALUES[topCard.rank] + 1
  )
}

export function canMoveToTableau(cardsToMove, targetPile) {
  if (!isValidFaceUpSequence(cardsToMove)) return false

  const firstCard = cardsToMove[0]
  if (targetPile.length === 0) return firstCard.rank === 'K'

  const targetCard = targetPile[targetPile.length - 1]
  return (
    targetCard.faceUp &&
    isOppositeColor(firstCard, targetCard) &&
    RANK_VALUES[firstCard.rank] === RANK_VALUES[targetCard.rank] - 1
  )
}

export function flipTopTableauCard(gameState, tableauIndex) {
  const revealed = revealTopCard(gameState.tableau, tableauIndex)
  if (!revealed.flipped) return failure(gameState, 'No face-down card to flip')

  return finalizeMove(
    { ...gameState, tableau: revealed.tableau },
    'Turned over a tableau card · +5',
    5,
  )
}

export function moveWasteToFoundation(gameState, foundationIndex) {
  const card = gameState.waste[gameState.waste.length - 1]
  const targetPile = gameState.foundations[foundationIndex]

  if (!targetPile || !canMoveToFoundation(card, targetPile)) {
    return failure(gameState)
  }

  const piles = clonePiles(gameState)
  piles.waste.pop()
  piles.foundations[foundationIndex].push(card)

  return finalizeMove(
    { ...gameState, ...piles },
    'Moved waste card to foundation · +10',
    10,
  )
}

export function moveWasteToTableau(gameState, tableauIndex) {
  const card = gameState.waste[gameState.waste.length - 1]
  const targetPile = gameState.tableau[tableauIndex]

  if (!targetPile || !canMoveToTableau(card ? [card] : [], targetPile)) {
    return failure(gameState)
  }

  const piles = clonePiles(gameState)
  piles.waste.pop()
  piles.tableau[tableauIndex].push(card)

  return finalizeMove(
    { ...gameState, ...piles },
    'Moved waste card to tableau',
  )
}

export function moveTableauToFoundation(
  gameState,
  tableauIndex,
  foundationIndex,
) {
  const sourcePile = gameState.tableau[tableauIndex]
  const targetPile = gameState.foundations[foundationIndex]
  const card = sourcePile?.[sourcePile.length - 1]

  if (!sourcePile || !targetPile || !canMoveToFoundation(card, targetPile)) {
    return failure(gameState)
  }

  const piles = clonePiles(gameState)
  piles.tableau[tableauIndex].pop()
  piles.foundations[foundationIndex].push(card)
  const revealed = revealTopCard(piles.tableau, tableauIndex)
  const scoreGained = 10 + (revealed.flipped ? 5 : 0)

  return finalizeMove(
    {
      ...gameState,
      ...piles,
      tableau: revealed.tableau,
    },
    revealed.flipped
      ? 'Moved to foundation and turned over a card · +15'
      : 'Moved to foundation · +10',
    scoreGained,
  )
}

export function moveTableauToTableau(
  gameState,
  fromIndex,
  cardIndex,
  toIndex,
) {
  if (fromIndex === toIndex) return failure(gameState)

  const sourcePile = gameState.tableau[fromIndex]
  const targetPile = gameState.tableau[toIndex]
  const cardsToMove = sourcePile?.slice(cardIndex) ?? []

  if (
    !sourcePile ||
    !targetPile ||
    cardIndex < 0 ||
    cardIndex >= sourcePile.length ||
    !canMoveToTableau(cardsToMove, targetPile)
  ) {
    return failure(gameState)
  }

  const piles = clonePiles(gameState)
  piles.tableau[fromIndex] = sourcePile.slice(0, cardIndex)
  piles.tableau[toIndex] = [...targetPile, ...cardsToMove]
  const revealed = revealTopCard(piles.tableau, fromIndex)

  return finalizeMove(
    {
      ...gameState,
      ...piles,
      tableau: revealed.tableau,
    },
    revealed.flipped
      ? 'Moved cards and turned over a card · +5'
      : 'Moved cards to tableau',
    revealed.flipped ? 5 : 0,
  )
}

export function checkWin(gameState) {
  return gameState.foundations.every((pile) => pile.length === 13)
}

export function calculateScore(gameState) {
  return Math.max(0, Number(gameState.score) || 0)
}
