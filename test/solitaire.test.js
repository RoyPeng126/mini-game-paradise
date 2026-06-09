import assert from 'node:assert/strict'
import test from 'node:test'
import { createDeck } from '../src/games/shared/cardUtils.js'
import {
  canMoveToFoundation,
  canMoveToTableau,
  checkWin,
  createInitialSolitaireGame,
  drawFromStock,
  moveTableauToTableau,
} from '../src/games/solitaire/logic.js'

const card = (rank, suit = 'spades', faceUp = true) => ({
  rank,
  suit,
  id: `${suit}-${rank}`,
  faceUp,
})

test('initial deal creates seven tableau columns with one through seven cards', () => {
  const game = createInitialSolitaireGame(createDeck())

  assert.equal(game.tableau.length, 7)
  assert.deepEqual(game.tableau.map((column) => column.length), [1, 2, 3, 4, 5, 6, 7])
})

test('only the final card in each tableau column is face up', () => {
  const game = createInitialSolitaireGame(createDeck())

  game.tableau.forEach((column) => {
    assert.equal(column[column.length - 1].faceUp, true)
    assert.ok(column.slice(0, -1).every((tableauCard) => !tableauCard.faceUp))
  })
})

test('initial stock contains the remaining 24 cards', () => {
  const game = createInitialSolitaireGame(createDeck())
  assert.equal(game.stock.length, 24)
  assert.ok(game.stock.every((stockCard) => !stockCard.faceUp))
})

test('empty foundation accepts only a face-up ace', () => {
  assert.equal(canMoveToFoundation(card('A'), []), true)
  assert.equal(canMoveToFoundation(card('2'), []), false)
  assert.equal(canMoveToFoundation(card('A', 'spades', false), []), false)
})

test('foundation requires the same suit in ascending order', () => {
  const foundation = [card('A', 'hearts')]
  assert.equal(canMoveToFoundation(card('2', 'hearts'), foundation), true)
  assert.equal(canMoveToFoundation(card('2', 'diamonds'), foundation), false)
  assert.equal(canMoveToFoundation(card('3', 'hearts'), foundation), false)
})

test('empty tableau accepts only a face-up king', () => {
  assert.equal(canMoveToTableau([card('K')], []), true)
  assert.equal(canMoveToTableau([card('Q')], []), false)
  assert.equal(canMoveToTableau([card('K', 'spades', false)], []), false)
})

test('tableau requires alternating colors in descending order', () => {
  const target = [card('9', 'spades')]
  assert.equal(canMoveToTableau([card('8', 'hearts')], target), true)
  assert.equal(canMoveToTableau([card('8', 'clubs')], target), false)
  assert.equal(canMoveToTableau([card('7', 'hearts')], target), false)
})

test('face-down tableau cards cannot be moved', () => {
  const game = {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [
      [card('K', 'spades', false)],
      [],
      [],
      [],
      [],
      [],
      [],
    ],
    moves: 0,
    score: 0,
    won: false,
  }
  const result = moveTableauToTableau(game, 0, 0, 1)

  assert.equal(result.moved, false)
  assert.equal(result.gameState, game)
})

test('drawFromStock moves the stock top card to waste face up', () => {
  const game = createInitialSolitaireGame(createDeck())
  const topCard = game.stock[0]
  const result = drawFromStock(game)

  assert.equal(result.moved, true)
  assert.equal(result.gameState.stock.length, 23)
  assert.equal(result.gameState.waste.length, 1)
  assert.equal(result.gameState.waste[0].id, topCard.id)
  assert.equal(result.gameState.waste[0].faceUp, true)
})

test('empty stock resets reversed waste as face-down stock', () => {
  const game = {
    stock: [],
    waste: [card('A', 'hearts'), card('2', 'clubs')],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    moves: 3,
    score: 10,
    won: false,
  }
  const result = drawFromStock(game)

  assert.equal(result.moved, true)
  assert.deepEqual(result.gameState.stock.map((stockCard) => stockCard.rank), ['2', 'A'])
  assert.ok(result.gameState.stock.every((stockCard) => !stockCard.faceUp))
  assert.equal(result.gameState.waste.length, 0)
  assert.equal(result.gameState.score, 0)
})

test('checkWin returns true when all four foundations contain 13 cards', () => {
  const foundations = ['hearts', 'diamonds', 'clubs', 'spades'].map((suit) =>
    createDeck()
      .filter((deckCard) => deckCard.suit === suit)
      .map((deckCard) => ({ ...deckCard, faceUp: true })),
  )

  assert.equal(checkWin({ foundations }), true)
  foundations[0].pop()
  assert.equal(checkWin({ foundations }), false)
})
