<script setup>
import { computed, onMounted, ref } from 'vue'
import { useScoreStore } from '../../stores/scoreStore'
import ScoreBoard from '../../components/ScoreBoard.vue'
import {
  GAME_RESULTS,
  GAME_STATUS,
  calculateHandValue,
  createInitialGame,
  playerHit,
  playerStand,
} from './logic'

const scoreStore = useScoreStore()
const gameState = ref(null)
const score = ref(0)

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const resultContent = {
  [GAME_RESULTS.PLAYER_WIN]: {
    eyebrow: 'Round won · +100',
    title: 'You beat the dealer',
    message: 'Your hand is closer to 21.',
  },
  [GAME_RESULTS.DEALER_WIN]: {
    eyebrow: 'Dealer wins',
    title: 'House takes the round',
    message: 'The dealer finished with the stronger hand.',
  },
  [GAME_RESULTS.PUSH]: {
    eyebrow: 'Push · +0',
    title: 'It is a tie',
    message: 'Same value. Your score stays where it is.',
  },
  [GAME_RESULTS.PLAYER_BUST]: {
    eyebrow: 'Bust',
    title: 'Over 21',
    message: 'Your hand went over the limit.',
  },
  [GAME_RESULTS.DEALER_BUST]: {
    eyebrow: 'Dealer bust · +100',
    title: 'You win the round',
    message: 'The dealer went over 21.',
  },
  [GAME_RESULTS.BLACKJACK]: {
    eyebrow: 'Natural Blackjack · +150',
    title: 'Blackjack!',
    message: 'An ace and a ten-value card. Perfect deal.',
  },
}

const bestScore = computed(() => scoreStore.getBestScore('blackjack'))
const isPlayerTurn = computed(
  () => gameState.value?.status === GAME_STATUS.PLAYER_TURN,
)
const roundResult = computed(() =>
  gameState.value?.result ? resultContent[gameState.value.result] : null,
)
const playerValue = computed(() =>
  gameState.value ? calculateHandValue(gameState.value.playerHand) : 0,
)
const dealerValue = computed(() => {
  if (!gameState.value) return 0
  if (isPlayerTurn.value) {
    return calculateHandValue([gameState.value.dealerHand[0]])
  }
  return calculateHandValue(gameState.value.dealerHand)
})

function scoreRound(result) {
  if (result === GAME_RESULTS.BLACKJACK) return 150
  if ([GAME_RESULTS.PLAYER_WIN, GAME_RESULTS.DEALER_BUST].includes(result)) {
    return 100
  }
  return 0
}

function applyCompletedRound(nextState, previousState = null) {
  const justFinished =
    nextState.status === GAME_STATUS.FINISHED &&
    previousState?.status !== GAME_STATUS.FINISHED

  if (justFinished) {
    score.value += scoreRound(nextState.result)
    scoreStore.updateBestScore('blackjack', score.value)
  }

  gameState.value = nextState
}

function newRound() {
  applyCompletedRound(createInitialGame())
}

function hit() {
  if (!gameState.value) return
  applyCompletedRound(playerHit(gameState.value), gameState.value)
}

function stand() {
  if (!gameState.value) return
  applyCompletedRound(playerStand(gameState.value), gameState.value)
}

function resetScore() {
  score.value = 0
}

function cardColorClass(card) {
  return ['hearts', 'diamonds'].includes(card.suit) ? 'playing-card--red' : ''
}

onMounted(() => {
  scoreStore.loadScores()
  newRound()
})
</script>

<template>
  <div class="blackjack-page container">
    <div class="blackjack-nav">
      <RouterLink class="back-link" to="/">
        <span aria-hidden="true">←</span>
        Back to Home
      </RouterLink>
      <button class="blackjack-reset" type="button" @click="resetScore">
        Reset Score
      </button>
    </div>

    <section v-if="gameState" class="blackjack">
      <header class="blackjack__header">
        <div>
          <span class="game-kicker">Casino classic</span>
          <h1>Blackjack</h1>
          <p>Beat the dealer without going over 21.</p>
        </div>
        <ScoreBoard :score="score" :best-score="bestScore" />
      </header>

      <div class="blackjack-table">
        <div class="table-light table-light--left"></div>
        <div class="table-light table-light--right"></div>

        <section class="hand-area" aria-labelledby="dealer-heading">
          <div class="hand-heading">
            <div>
              <span class="hand-heading__role">House</span>
              <h2 id="dealer-heading">Dealer</h2>
            </div>
            <span class="hand-value">
              {{ dealerValue }}<template v-if="isPlayerTurn"> + ?</template>
            </span>
          </div>

          <div class="card-hand">
            <div
              v-for="(card, index) in gameState.dealerHand"
              :key="card.id"
              class="playing-card"
              :class="[
                cardColorClass(card),
                { 'playing-card--hidden': isPlayerTurn && index === 1 },
              ]"
              :aria-label="
                isPlayerTurn && index === 1
                  ? 'Hidden dealer card'
                  : `${card.rank} of ${card.suit}`
              "
            >
              <template v-if="!(isPlayerTurn && index === 1)">
                <span class="playing-card__rank">{{ card.rank }}</span>
                <span class="playing-card__suit">{{ suitSymbols[card.suit] }}</span>
                <span class="playing-card__corner">
                  {{ card.rank }}<small>{{ suitSymbols[card.suit] }}</small>
                </span>
              </template>
              <span v-else class="playing-card__back-mark" aria-hidden="true">21</span>
            </div>
          </div>
        </section>

        <div class="table-rule">
          <span></span>
          Dealer stands on 17
          <span></span>
        </div>

        <section class="hand-area" aria-labelledby="player-heading">
          <div class="hand-heading">
            <div>
              <span class="hand-heading__role">Your hand</span>
              <h2 id="player-heading">Player</h2>
            </div>
            <span class="hand-value hand-value--player">{{ playerValue }}</span>
          </div>

          <div class="card-hand">
            <div
              v-for="card in gameState.playerHand"
              :key="card.id"
              class="playing-card"
              :class="cardColorClass(card)"
              :aria-label="`${card.rank} of ${card.suit}`"
            >
              <span class="playing-card__rank">{{ card.rank }}</span>
              <span class="playing-card__suit">{{ suitSymbols[card.suit] }}</span>
              <span class="playing-card__corner">
                {{ card.rank }}<small>{{ suitSymbols[card.suit] }}</small>
              </span>
            </div>
          </div>
        </section>

        <div v-if="isPlayerTurn" class="blackjack-actions">
          <button class="button blackjack-button blackjack-button--hit" type="button" @click="hit">
            Hit
            <span aria-hidden="true">＋</span>
          </button>
          <button class="button blackjack-button blackjack-button--stand" type="button" @click="stand">
            Stand
            <span aria-hidden="true">■</span>
          </button>
        </div>

        <div v-else class="round-result" aria-live="polite">
          <span>{{ roundResult.eyebrow }}</span>
          <h2>{{ roundResult.title }}</h2>
          <p>{{ roundResult.message }}</p>
          <button class="button button--primary" type="button" @click="newRound">
            New Round
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
