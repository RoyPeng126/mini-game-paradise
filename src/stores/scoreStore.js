import { defineStore } from 'pinia'

const STORAGE_KEY = 'mini-game-best-scores'
const TIME_STORAGE_KEY = 'mini-game-best-times'

export const useScoreStore = defineStore('scores', {
  state: () => ({
    bestScores: {},
    bestTimes: {},
  }),

  actions: {
    loadScores() {
      if (typeof window === 'undefined') return

      try {
        const savedScores = localStorage.getItem(STORAGE_KEY)
        const savedTimes = localStorage.getItem(TIME_STORAGE_KEY)
        this.bestScores = savedScores ? JSON.parse(savedScores) : {}
        this.bestTimes = savedTimes ? JSON.parse(savedTimes) : {}
      } catch {
        this.bestScores = {}
        this.bestTimes = {}
      }
    },

    updateBestScore(gameId, score) {
      if (score <= this.getBestScore(gameId)) return

      this.bestScores = {
        ...this.bestScores,
        [gameId]: score,
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bestScores))
      }
    },

    getBestScore(gameId) {
      return Number(this.bestScores[gameId]) || 0
    },

    updateBestTime(gameId, seconds) {
      const currentBest = this.getBestTime(gameId)
      if (seconds <= 0 || (currentBest > 0 && seconds >= currentBest)) return

      this.bestTimes = {
        ...this.bestTimes,
        [gameId]: seconds,
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(TIME_STORAGE_KEY, JSON.stringify(this.bestTimes))
      }
    },

    getBestTime(gameId) {
      return Number(this.bestTimes[gameId]) || 0
    },
  },
})
