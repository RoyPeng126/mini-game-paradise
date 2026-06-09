import { createDeck, drawCard, shuffleDeck } from '../shared/cardUtils.js'

export const GAME_STATUS = {
  PLAYER_TURN: 'playerTurn',
  FINISHED: 'finished',
}

export const GAME_RESULTS = {
  PLAYER_WIN: 'playerWin',
  DEALER_WIN: 'dealerWin',
  PUSH: 'push',
  PLAYER_BUST: 'playerBust',
  DEALER_BUST: 'dealerBust',
  BLACKJACK: 'blackjack',
}

export const BLACKJACK_PAYOUT_MULTIPLIER = 2.5

export function calculateRoundPayout(result, bet) {
  if (result === GAME_RESULTS.BLACKJACK) {
    return bet * BLACKJACK_PAYOUT_MULTIPLIER
  }

  if ([GAME_RESULTS.PLAYER_WIN, GAME_RESULTS.DEALER_BUST].includes(result)) {
    return bet * 2
  }

  if (result === GAME_RESULTS.PUSH) return bet
  return 0
}

export function getCardValue(card) {
  if (card.rank === 'A') return 11
  if (['J', 'Q', 'K'].includes(card.rank)) return 10
  return Number(card.rank)
}

export function calculateHandValue(hand) {
  let value = hand.reduce((total, card) => total + getCardValue(card), 0)
  let aces = hand.filter((card) => card.rank === 'A').length

  while (value > 21 && aces > 0) {
    value -= 10
    aces -= 1
  }

  return value
}

export function isBlackjack(hand) {
  return hand.length === 2 && calculateHandValue(hand) === 21
}

export function isBust(hand) {
  return calculateHandValue(hand) > 21
}

export function determineWinner(gameState) {
  const playerBlackjack = isBlackjack(gameState.playerHand)
  const dealerBlackjack = isBlackjack(gameState.dealerHand)

  if (isBust(gameState.playerHand)) return GAME_RESULTS.PLAYER_BUST
  if (playerBlackjack && !dealerBlackjack) return GAME_RESULTS.BLACKJACK
  if (dealerBlackjack && !playerBlackjack) return GAME_RESULTS.DEALER_WIN
  if (playerBlackjack && dealerBlackjack) return GAME_RESULTS.PUSH
  if (isBust(gameState.dealerHand)) return GAME_RESULTS.DEALER_BUST

  const playerValue = calculateHandValue(gameState.playerHand)
  const dealerValue = calculateHandValue(gameState.dealerHand)

  if (playerValue > dealerValue) return GAME_RESULTS.PLAYER_WIN
  if (dealerValue > playerValue) return GAME_RESULTS.DEALER_WIN
  return GAME_RESULTS.PUSH
}

export function createInitialGame(deck = shuffleDeck(createDeck())) {
  let remainingDeck = [...deck]
  const playerHand = []
  const dealerHand = []

  for (let index = 0; index < 2; index += 1) {
    const playerDraw = drawCard(remainingDeck)
    if (playerDraw.card) playerHand.push(playerDraw.card)
    remainingDeck = playerDraw.remainingDeck

    const dealerDraw = drawCard(remainingDeck)
    if (dealerDraw.card) dealerHand.push(dealerDraw.card)
    remainingDeck = dealerDraw.remainingDeck
  }

  const gameState = {
    deck: remainingDeck,
    playerHand,
    dealerHand,
    status: GAME_STATUS.PLAYER_TURN,
    result: null,
  }

  if (isBlackjack(playerHand) || isBlackjack(dealerHand)) {
    return {
      ...gameState,
      status: GAME_STATUS.FINISHED,
      result: determineWinner(gameState),
    }
  }

  return gameState
}

export function playerHit(gameState) {
  if (gameState.status !== GAME_STATUS.PLAYER_TURN) return gameState

  const { card, remainingDeck } = drawCard(gameState.deck)
  if (!card) return gameState

  const nextState = {
    ...gameState,
    deck: remainingDeck,
    playerHand: [...gameState.playerHand, card],
  }

  if (isBust(nextState.playerHand)) {
    return {
      ...nextState,
      status: GAME_STATUS.FINISHED,
      result: GAME_RESULTS.PLAYER_BUST,
    }
  }

  if (calculateHandValue(nextState.playerHand) === 21) {
    return playerStand(nextState)
  }

  return nextState
}

export function dealerPlay(gameState) {
  let deck = [...gameState.deck]
  let dealerHand = [...gameState.dealerHand]

  while (calculateHandValue(dealerHand) < 17 && deck.length > 0) {
    const draw = drawCard(deck)
    if (!draw.card) break
    dealerHand = [...dealerHand, draw.card]
    deck = draw.remainingDeck
  }

  return {
    ...gameState,
    deck,
    dealerHand,
  }
}

export function playerStand(gameState) {
  if (gameState.status !== GAME_STATUS.PLAYER_TURN) return gameState

  const dealerState = dealerPlay(gameState)
  return {
    ...dealerState,
    status: GAME_STATUS.FINISHED,
    result: determineWinner(dealerState),
  }
}
