import { defineStore } from 'pinia'

const STORAGE_KEY = 'mini-game-best-scores'

export const useScoreStore = defineStore('scores', {
  state: () => ({
    bestScores: {},
  }),

  actions: {
    loadScores() {
      if (typeof window === 'undefined') return

      try {
        const savedScores = localStorage.getItem(STORAGE_KEY)
        this.bestScores = savedScores ? JSON.parse(savedScores) : {}
      } catch {
        this.bestScores = {}
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
  },
})
