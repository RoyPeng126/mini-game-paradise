import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GAME_RESULTS,
  GAME_STATUS,
  canSplitPair,
  calculateRoundPayout,
  calculateHandValue,
  createSplitHands,
  dealerPlay,
  determineSplitHandWinner,
  determineWinner,
  getCardValue,
  isBlackjack,
  isBust,
  isFiveCardCharlie,
  playerDoubleDown,
  playerHit,
} from '../src/games/blackjack/logic.js'

const card = (rank, suit = 'spades') => ({
  rank,
  suit,
  id: `${suit}-${rank}`,
})

const game = (playerHand, dealerHand, deck = []) => ({
  playerHand,
  dealerHand,
  deck,
  status: GAME_STATUS.PLAYER_TURN,
  result: null,
})

test('ace counts as 11 or 1 to make the best valid hand', () => {
  assert.equal(calculateHandValue([card('A'), card('9')]), 20)
  assert.equal(calculateHandValue([card('A'), card('9'), card('5')]), 15)
  assert.equal(calculateHandValue([card('A'), card('A'), card('9')]), 21)
})

test('face cards are worth 10', () => {
  assert.equal(getCardValue(card('J')), 10)
  assert.equal(getCardValue(card('Q')), 10)
  assert.equal(getCardValue(card('K')), 10)
})

test('blackjack requires exactly two cards totaling 21', () => {
  assert.equal(isBlackjack([card('A'), card('K')]), true)
  assert.equal(isBlackjack([card('7'), card('7'), card('7')]), false)
})

test('bust is detected above 21', () => {
  assert.equal(isBust([card('K'), card('Q'), card('2')]), true)
  assert.equal(isBust([card('K'), card('A')]), false)
})

test('dealer draws until reaching at least 17', () => {
  const state = game(
    [card('10'), card('8')],
    [card('6'), card('8')],
    [card('2'), card('A'), card('K')],
  )
  const result = dealerPlay(state)

  assert.equal(calculateHandValue(result.dealerHand), 17)
  assert.equal(result.dealerHand.length, 4)
  assert.equal(result.deck.length, 1)
})

test('player loses immediately after going over 21', () => {
  const state = game(
    [card('K'), card('9')],
    [card('10'), card('7')],
    [card('5')],
  )
  const result = playerHit(state)

  assert.equal(result.status, GAME_STATUS.FINISHED)
  assert.equal(result.result, GAME_RESULTS.PLAYER_BUST)
})

test('higher player hand wins', () => {
  const state = game(
    [card('10'), card('9')],
    [card('10'), card('8')],
  )

  assert.equal(determineWinner(state), GAME_RESULTS.PLAYER_WIN)
})

test('equal hand values produce a push', () => {
  const state = game(
    [card('10'), card('8')],
    [card('K'), card('8')],
  )

  assert.equal(determineWinner(state), GAME_RESULTS.PUSH)
})

test('natural blackjack beats a regular 21', () => {
  const state = game(
    [card('A'), card('K')],
    [card('7'), card('7'), card('7')],
  )

  assert.equal(determineWinner(state), GAME_RESULTS.BLACKJACK)
})

test('round payouts return the stake plus the correct winnings', () => {
  assert.equal(calculateRoundPayout(GAME_RESULTS.PLAYER_WIN, 20), 40)
  assert.equal(calculateRoundPayout(GAME_RESULTS.DEALER_BUST, 20), 40)
  assert.equal(calculateRoundPayout(GAME_RESULTS.BLACKJACK, 20), 50)
  assert.equal(calculateRoundPayout(GAME_RESULTS.PUSH, 20), 20)
})

test('lost rounds do not return any chips', () => {
  assert.equal(calculateRoundPayout(GAME_RESULTS.DEALER_WIN, 20), 0)
  assert.equal(calculateRoundPayout(GAME_RESULTS.PLAYER_BUST, 20), 0)
})

test('double down draws exactly one card and finishes the round', () => {
  const state = game(
    [card('5'), card('6')],
    [card('10'), card('7')],
    [card('10'), card('2')],
  )
  const result = playerDoubleDown(state)

  assert.equal(result.playerHand.length, 3)
  assert.equal(result.deck.length, 1)
  assert.equal(result.status, GAME_STATUS.FINISHED)
  assert.equal(result.result, GAME_RESULTS.PLAYER_WIN)
})

test('double down finishes immediately when the one card causes a bust', () => {
  const state = game(
    [card('10'), card('9')],
    [card('10'), card('7')],
    [card('5')],
  )
  const result = playerDoubleDown(state)

  assert.equal(result.playerHand.length, 3)
  assert.equal(result.status, GAME_STATUS.FINISHED)
  assert.equal(result.result, GAME_RESULTS.PLAYER_BUST)
})

test('double down is unavailable after the player has already hit', () => {
  const state = game(
    [card('4'), card('5'), card('2')],
    [card('10'), card('7')],
    [card('10')],
  )

  assert.equal(playerDoubleDown(state), state)
})

test('only two cards with the same rank can be split', () => {
  assert.equal(canSplitPair([card('8'), card('8', 'hearts')]), true)
  assert.equal(canSplitPair([card('10'), card('K')]), false)
  assert.equal(canSplitPair([card('8'), card('8'), card('2')]), false)
})

test('splitting deals one new card to each hand', () => {
  const result = createSplitHands(
    [card('8'), card('8', 'hearts')],
    [card('3'), card('K'), card('5')],
  )

  assert.deepEqual(result.hands[0].map(({ rank }) => rank), ['8', '3'])
  assert.deepEqual(result.hands[1].map(({ rank }) => rank), ['8', 'K'])
  assert.equal(result.remainingDeck.length, 1)
})

test('a split hand totaling 21 is a regular win rather than blackjack', () => {
  assert.equal(
    determineSplitHandWinner(
      [card('A'), card('K')],
      [card('10'), card('9')],
    ),
    GAME_RESULTS.PLAYER_WIN,
  )
})

test('dealer natural blackjack beats a split hand totaling 21', () => {
  assert.equal(
    determineSplitHandWinner(
      [card('A'), card('K')],
      [card('A'), card('Q')],
    ),
    GAME_RESULTS.DEALER_WIN,
  )
})

test('five cards at 21 or less qualify for Five Card Charlie', () => {
  assert.equal(
    isFiveCardCharlie([
      card('2'),
      card('3'),
      card('4'),
      card('5'),
      card('6'),
    ]),
    true,
  )
  assert.equal(
    isFiveCardCharlie([
      card('2'),
      card('3'),
      card('4'),
      card('5'),
      card('8'),
    ]),
    false,
  )
  assert.equal(
    isFiveCardCharlie([card('2'), card('3'), card('4'), card('5')]),
    false,
  )
})

test('hitting to five cards without busting immediately wins', () => {
  const state = game(
    [card('2'), card('3'), card('4'), card('5')],
    [card('10'), card('9')],
    [card('6'), card('K')],
  )
  const result = playerHit(state)

  assert.equal(result.playerHand.length, 5)
  assert.equal(result.status, GAME_STATUS.FINISHED)
  assert.equal(result.result, GAME_RESULTS.FIVE_CARD_CHARLIE)
  assert.equal(result.dealerHand.length, 2)
})

test('Five Card Charlie pays two-to-one winnings plus the returned stake', () => {
  assert.equal(
    calculateRoundPayout(GAME_RESULTS.FIVE_CARD_CHARLIE, 20),
    60,
  )
})

test('Five Card Charlie wins a split hand regardless of dealer total', () => {
  assert.equal(
    determineSplitHandWinner(
      [card('2'), card('3'), card('4'), card('5'), card('6')],
      [card('K'), card('A')],
    ),
    GAME_RESULTS.FIVE_CARD_CHARLIE,
  )
})
