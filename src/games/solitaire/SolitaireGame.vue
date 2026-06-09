<script setup>
import { computed, onMounted, ref } from 'vue'
import ScoreBoard from '../../components/ScoreBoard.vue'
import { useScoreStore } from '../../stores/scoreStore'
import {
  calculateScore,
  createInitialSolitaireGame,
  drawFromStock,
  moveTableauToFoundation,
  moveTableauToTableau,
  moveWasteToFoundation,
  moveWasteToTableau,
} from './logic'

const scoreStore = useScoreStore()
const gameState = ref(null)
const selected = ref(null)
const message = ref('Select a face-up card to begin')

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const foundationSymbols = ['♥', '♦', '♣', '♠']
const bestScore = computed(() => scoreStore.getBestScore('solitaire'))
const score = computed(() => (gameState.value ? calculateScore(gameState.value) : 0))

function newGame() {
  gameState.value = createInitialSolitaireGame()
  selected.value = null
  message.value = 'New game dealt. Select a face-up card.'
}

function applyResult(result) {
  gameState.value = result.gameState
  message.value = result.message

  if (result.moved) {
    selected.value = null
    scoreStore.updateBestScore('solitaire', calculateScore(result.gameState))
  }
}

function handleStock() {
  selected.value = null
  applyResult(drawFromStock(gameState.value))
}

function selectWaste() {
  if (gameState.value.waste.length === 0) {
    message.value = 'Waste is empty'
    return
  }

  selected.value = { type: 'waste' }
  message.value = 'Waste card selected. Choose a foundation or tableau.'
}

function selectTableauCard(tableauIndex, cardIndex, card) {
  if (selected.value && selected.value.type === 'tableau') {
    const isSameCard =
      selected.value.tableauIndex === tableauIndex &&
      selected.value.cardIndex === cardIndex

    if (isSameCard) {
      selected.value = null
      message.value = 'Selection cleared'
      return
    }

    if (selected.value.tableauIndex !== tableauIndex) {
      moveSelectionToTableau(tableauIndex)
      return
    }
  }

  if (selected.value?.type === 'waste') {
    moveSelectionToTableau(tableauIndex)
    return
  }

  if (!card.faceUp) {
    message.value = 'Face-down cards cannot be moved'
    return
  }

  selected.value = {
    type: 'tableau',
    tableauIndex,
    cardIndex,
  }
  message.value = 'Tableau cards selected. Choose a destination.'
}

function moveSelectionToTableau(tableauIndex) {
  if (!selected.value) {
    message.value = 'Select a waste or tableau card first'
    return
  }

  const result =
    selected.value.type === 'waste'
      ? moveWasteToTableau(gameState.value, tableauIndex)
      : moveTableauToTableau(
          gameState.value,
          selected.value.tableauIndex,
          selected.value.cardIndex,
          tableauIndex,
        )

  applyResult(result)
}

function moveSelectionToFoundation(foundationIndex) {
  if (!selected.value) {
    message.value = 'Select a waste or tableau card first'
    return
  }

  const result =
    selected.value.type === 'waste'
      ? moveWasteToFoundation(gameState.value, foundationIndex)
      : moveTableauToFoundation(
          gameState.value,
          selected.value.tableauIndex,
          foundationIndex,
        )

  applyResult(result)
}

function clearSelection() {
  selected.value = null
  message.value = 'Selection cleared'
}

function isWasteSelected() {
  return selected.value?.type === 'waste'
}

function isTableauCardSelected(tableauIndex, cardIndex) {
  return (
    selected.value?.type === 'tableau' &&
    selected.value.tableauIndex === tableauIndex &&
    cardIndex >= selected.value.cardIndex
  )
}

function isRed(card) {
  return ['hearts', 'diamonds'].includes(card.suit)
}

onMounted(() => {
  scoreStore.loadScores()
  newGame()
})
</script>

<template>
  <div class="solitaire-page container">
    <div class="solitaire-nav">
      <RouterLink class="back-link" to="/">
        <span aria-hidden="true">←</span>
        Back to Home
      </RouterLink>
      <button class="button solitaire-new-game" type="button" @click="newGame">
        <span aria-hidden="true">↻</span>
        New Game
      </button>
    </div>

    <section v-if="gameState" class="solitaire">
      <header class="solitaire__header">
        <div>
          <span class="game-kicker">Klondike classic</span>
          <h1>Solitaire</h1>
          <p>Build every suit from Ace to King.</p>
        </div>

        <div class="solitaire-stats">
          <ScoreBoard :score="score" :best-score="bestScore" />
          <div class="score-box solitaire-moves">
            <span>Moves</span>
            <strong>{{ gameState.moves }}</strong>
          </div>
        </div>
      </header>

      <div class="solitaire-message" :class="{ 'solitaire-message--win': gameState.won }">
        <span aria-hidden="true">{{ gameState.won ? '★' : '•' }}</span>
        <p>{{ message }}</p>
        <button v-if="selected" type="button" @click="clearSelection">Clear selection</button>
      </div>

      <div class="solitaire-scroll" aria-label="Scrollable Solitaire game area">
        <div class="solitaire-table">
          <div class="solitaire-top-row">
            <div class="solitaire-pile-group">
              <div class="solitaire-pile-wrap">
                <span class="solitaire-pile-label">Stock · {{ gameState.stock.length }}</span>
                <button
                  class="solitaire-card-slot solitaire-card-slot--clickable"
                  :class="{ 'solitaire-card-back': gameState.stock.length }"
                  type="button"
                  aria-label="Draw from stock"
                  @click="handleStock"
                >
                  <span v-if="gameState.stock.length" class="solitaire-back-mark">MGP</span>
                  <span v-else class="solitaire-empty-icon" aria-hidden="true">↻</span>
                </button>
              </div>

              <div class="solitaire-pile-wrap">
                <span class="solitaire-pile-label">Waste</span>
                <button
                  class="solitaire-card-slot solitaire-card-slot--clickable"
                  :class="{
                    'solitaire-card--selected': isWasteSelected(),
                    'solitaire-card--red':
                      gameState.waste.length && isRed(gameState.waste.at(-1)),
                  }"
                  type="button"
                  aria-label="Select waste card"
                  @click="selectWaste"
                >
                  <template v-if="gameState.waste.length">
                    <span class="solitaire-card-rank">{{ gameState.waste.at(-1).rank }}</span>
                    <span class="solitaire-card-suit">
                      {{ suitSymbols[gameState.waste.at(-1).suit] }}
                    </span>
                  </template>
                </button>
              </div>
            </div>

            <div class="solitaire-foundations">
              <div
                v-for="(foundation, foundationIndex) in gameState.foundations"
                :key="foundationIndex"
                class="solitaire-pile-wrap"
              >
                <span class="solitaire-pile-label">Foundation</span>
                <button
                  class="solitaire-card-slot solitaire-card-slot--clickable solitaire-foundation"
                  :class="{
                    'solitaire-card--red':
                      foundation.length && isRed(foundation.at(-1)),
                  }"
                  type="button"
                  :aria-label="`Move selected card to foundation ${foundationIndex + 1}`"
                  @click="moveSelectionToFoundation(foundationIndex)"
                >
                  <template v-if="foundation.length">
                    <span class="solitaire-card-rank">{{ foundation.at(-1).rank }}</span>
                    <span class="solitaire-card-suit">
                      {{ suitSymbols[foundation.at(-1).suit] }}
                    </span>
                  </template>
                  <span v-else class="solitaire-foundation-placeholder">
                    {{ foundationSymbols[foundationIndex] }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div class="solitaire-divider">
            <span>Tableau</span>
          </div>

          <div class="solitaire-tableau">
            <div
              v-for="(column, tableauIndex) in gameState.tableau"
              :key="tableauIndex"
              class="solitaire-column"
              :class="{ 'solitaire-column--empty': column.length === 0 }"
              role="button"
              tabindex="0"
              :aria-label="`Tableau column ${tableauIndex + 1}`"
              @click.self="moveSelectionToTableau(tableauIndex)"
              @keydown.enter="moveSelectionToTableau(tableauIndex)"
            >
              <button
                v-if="column.length === 0"
                class="solitaire-empty-tableau"
                type="button"
                @click="moveSelectionToTableau(tableauIndex)"
              >
                K
              </button>

              <button
                v-for="(card, cardIndex) in column"
                :key="card.id"
                class="solitaire-tableau-card"
                :class="{
                  'solitaire-card-back': !card.faceUp,
                  'solitaire-card--red': card.faceUp && isRed(card),
                  'solitaire-card--selected':
                    isTableauCardSelected(tableauIndex, cardIndex),
                }"
                :style="{
                  '--card-index': cardIndex,
                  '--card-top': `${cardIndex === 0 ? 0 : card.faceUp ? 28 : 16}px`,
                }"
                type="button"
                :aria-label="
                  card.faceUp
                    ? `${card.rank} of ${card.suit}`
                    : 'Face-down tableau card'
                "
                @click.stop="selectTableauCard(tableauIndex, cardIndex, card)"
              >
                <template v-if="card.faceUp">
                  <span class="solitaire-card-rank">{{ card.rank }}</span>
                  <span class="solitaire-card-suit">{{ suitSymbols[card.suit] }}</span>
                </template>
                <span v-else class="solitaire-back-mark">MGP</span>
              </button>
            </div>
          </div>

          <div v-if="gameState.won" class="solitaire-win-panel" aria-live="polite">
            <span>All four suits completed</span>
            <h2>You win!</h2>
            <p>Final score: {{ score.toLocaleString() }}</p>
            <button class="button button--primary" type="button" @click="newGame">
              Play again
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
