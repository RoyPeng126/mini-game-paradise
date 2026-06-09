export const ANALYTICS_KEYS = {
  visits: 'mini-game-local-visits',
  clickCounts: 'mini-game-click-counts',
  recentlyPlayed: 'mini-game-recently-played',
}

const ANALYTICS_UPDATED_EVENT = 'mini-game-analytics-updated'
const RECENTLY_PLAYED_LIMIT = 10

function getStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function readJson(key, fallback) {
  const storage = getStorage()
  if (!storage) return fallback

  try {
    const saved = storage.getItem(key)
    return saved === null ? fallback : JSON.parse(saved)
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Local analytics should never prevent navigation or gameplay.
  }
}

function notifyAnalyticsUpdated() {
  if (
    typeof globalThis.dispatchEvent === 'function' &&
    typeof globalThis.Event === 'function'
  ) {
    globalThis.dispatchEvent(new Event(ANALYTICS_UPDATED_EVENT))
  }
}

export function getLocalVisitCount() {
  const storage = getStorage()
  if (!storage) return 0

  const value = Number(storage.getItem(ANALYTICS_KEYS.visits))
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

export function incrementLocalVisitCount() {
  const nextCount = getLocalVisitCount() + 1
  const storage = getStorage()

  try {
    storage?.setItem(ANALYTICS_KEYS.visits, String(nextCount))
  } catch {
    return getLocalVisitCount()
  }

  notifyAnalyticsUpdated()
  return nextCount
}

export function getGameClickCounts() {
  const counts = readJson(ANALYTICS_KEYS.clickCounts, {})
  return counts && typeof counts === 'object' && !Array.isArray(counts)
    ? counts
    : {}
}

export function getGameClickCount(gameId) {
  const count = Number(getGameClickCounts()[gameId])
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

export function incrementGameClickCount(gameId) {
  if (!gameId) return 0

  const counts = getGameClickCounts()
  const nextCount = getGameClickCount(gameId) + 1
  writeJson(ANALYTICS_KEYS.clickCounts, {
    ...counts,
    [gameId]: nextCount,
  })
  notifyAnalyticsUpdated()
  return nextCount
}

export function getRecentlyPlayedGames() {
  const games = readJson(ANALYTICS_KEYS.recentlyPlayed, [])
  if (!Array.isArray(games)) return []

  return games.filter(
    (entry) =>
      entry &&
      typeof entry.gameId === 'string' &&
      typeof entry.playedAt === 'string',
  )
}

export function addRecentlyPlayedGame(gameId) {
  if (!gameId) return getRecentlyPlayedGames()

  const nextGames = [
    {
      gameId,
      playedAt: new Date().toISOString(),
    },
    ...getRecentlyPlayedGames().filter(
      (entry) => entry.gameId !== gameId,
    ),
  ].slice(0, RECENTLY_PLAYED_LIMIT)

  writeJson(ANALYTICS_KEYS.recentlyPlayed, nextGames)
  notifyAnalyticsUpdated()
  return nextGames
}

export function resetLocalAnalytics() {
  const storage = getStorage()
  if (!storage) return

  Object.values(ANALYTICS_KEYS).forEach((key) => {
    storage.removeItem(key)
  })
  notifyAnalyticsUpdated()
}

export function sortGamesByAnalytics(games, sortMode = 'default') {
  const copiedGames = [...games]

  if (sortMode === 'mostPlayed') {
    return copiedGames.sort(
      (a, b) =>
        getGameClickCount(b.id) - getGameClickCount(a.id),
    )
  }

  if (sortMode === 'recentlyPlayed') {
    const recentOrder = new Map(
      getRecentlyPlayedGames().map((entry, index) => [
        entry.gameId,
        index,
      ]),
    )

    return copiedGames.sort((a, b) => {
      const first = recentOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER
      const second = recentOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER
      return first - second
    })
  }

  if (sortMode === 'alphabetical') {
    return copiedGames.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, {
        sensitivity: 'base',
      }),
    )
  }

  return copiedGames
}

export function subscribeToAnalyticsUpdates(callback) {
  if (typeof globalThis.addEventListener !== 'function') {
    return () => {}
  }

  globalThis.addEventListener(ANALYTICS_UPDATED_EVENT, callback)
  return () => {
    globalThis.removeEventListener(
      ANALYTICS_UPDATED_EVENT,
      callback,
    )
  }
}

// After deployment, this local adapter can be replaced by Supabase,
// Firebase, a custom API, or a privacy-friendly analytics service.
// No external tracking script, API key, or backend request is used now.
