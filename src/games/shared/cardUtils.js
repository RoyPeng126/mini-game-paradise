export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades']

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export function createDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      suit,
      rank,
      id: `${suit}-${rank}`,
    })),
  )
}

export function shuffleDeck(deck) {
  const shuffledDeck = [...deck]

  for (let index = shuffledDeck.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffledDeck[index], shuffledDeck[randomIndex]] = [
      shuffledDeck[randomIndex],
      shuffledDeck[index],
    ]
  }

  return shuffledDeck
}

export function drawCard(deck) {
  if (deck.length === 0) {
    return { card: null, remainingDeck: [] }
  }

  const [card, ...remainingDeck] = deck
  return { card, remainingDeck }
}
