import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GAME_RESULTS,
  GAME_STATUS,
  calculateRoundPayout,
  calculateHandValue,
  dealerPlay,
  determineWinner,
  getCardValue,
  isBlackjack,
  isBust,
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
