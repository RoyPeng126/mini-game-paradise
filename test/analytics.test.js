import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ANALYTICS_KEYS,
  addRecentlyPlayedGame,
  getGameClickCount,
  getGameClickCounts,
  getLocalVisitCount,
  getRecentlyPlayedGames,
  incrementGameClickCount,
  incrementLocalVisitCount,
  resetLocalAnalytics,
  sortGamesByAnalytics,
} from '../src/utils/analytics.js'

class MemoryStorage {
  constructor() {
    this.values = new Map()
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }

  removeItem(key) {
    this.values.delete(key)
  }

  clear() {
    this.values.clear()
  }
}

const games = [
  { id: 'mahjong', title: 'Mahjong' },
  { id: '2048', title: '2048' },
  { id: 'blackjack', title: 'Blackjack' },
]

test.beforeEach(() => {
  globalThis.localStorage = new MemoryStorage()
})

test.after(() => {
  delete globalThis.localStorage
})

test('local visits start at zero and increment', () => {
  assert.equal(getLocalVisitCount(), 0)
  assert.equal(incrementLocalVisitCount(), 1)
  assert.equal(incrementLocalVisitCount(), 2)
  assert.equal(getLocalVisitCount(), 2)
})

test('game click counts increment and unknown games return zero', () => {
  assert.deepEqual(getGameClickCounts(), {})
  assert.equal(getGameClickCount('mahjong'), 0)
  assert.equal(incrementGameClickCount('mahjong'), 1)
  assert.equal(incrementGameClickCount('mahjong'), 2)
  assert.deepEqual(getGameClickCounts(), { mahjong: 2 })
})

test('recently played adds games and moves repeated games first', async () => {
  addRecentlyPlayedGame('mahjong')
  const firstTimestamp = getRecentlyPlayedGames()[0].playedAt
  await new Promise((resolve) => setTimeout(resolve, 2))
  addRecentlyPlayedGame('blackjack')
  addRecentlyPlayedGame('mahjong')

  const recent = getRecentlyPlayedGames()
  assert.equal(recent[0].gameId, 'mahjong')
  assert.equal(recent[1].gameId, 'blackjack')
  assert.notEqual(recent[0].playedAt, firstTimestamp)
})

test('recently played keeps at most ten unique games', () => {
  for (let index = 0; index < 12; index += 1) {
    addRecentlyPlayedGame(`game-${index}`)
  }

  const recent = getRecentlyPlayedGames()
  assert.equal(recent.length, 10)
  assert.equal(recent[0].gameId, 'game-11')
  assert.equal(recent.at(-1).gameId, 'game-2')
})

test('default sorting preserves the original order', () => {
  assert.deepEqual(
    sortGamesByAnalytics(games, 'default').map((game) => game.id),
    ['mahjong', '2048', 'blackjack'],
  )
})

test('most played sorting uses local click counts', () => {
  incrementGameClickCount('blackjack')
  incrementGameClickCount('mahjong')
  incrementGameClickCount('mahjong')

  assert.deepEqual(
    sortGamesByAnalytics(games, 'mostPlayed').map((game) => game.id),
    ['mahjong', 'blackjack', '2048'],
  )
})

test('recently played sorting puts unplayed games last', () => {
  addRecentlyPlayedGame('mahjong')
  addRecentlyPlayedGame('blackjack')

  assert.deepEqual(
    sortGamesByAnalytics(games, 'recentlyPlayed').map(
      (game) => game.id,
    ),
    ['blackjack', 'mahjong', '2048'],
  )
})

test('alphabetical sorting uses game titles', () => {
  assert.deepEqual(
    sortGamesByAnalytics(games, 'alphabetical').map(
      (game) => game.title,
    ),
    ['2048', 'Blackjack', 'Mahjong'],
  )
})

test('resetLocalAnalytics clears every analytics key', () => {
  incrementLocalVisitCount()
  incrementGameClickCount('mahjong')
  addRecentlyPlayedGame('mahjong')
  resetLocalAnalytics()

  assert.equal(getLocalVisitCount(), 0)
  assert.deepEqual(getGameClickCounts(), {})
  assert.deepEqual(getRecentlyPlayedGames(), [])
  Object.values(ANALYTICS_KEYS).forEach((key) => {
    assert.equal(globalThis.localStorage.getItem(key), null)
  })
})
