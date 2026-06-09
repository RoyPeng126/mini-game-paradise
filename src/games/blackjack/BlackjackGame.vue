<script setup>
import { computed, onMounted, ref } from 'vue'
import { useScoreStore } from '../../stores/scoreStore'
import ScoreBoard from '../../components/ScoreBoard.vue'
import {
  GAME_RESULTS,
  GAME_STATUS,
  canSplitPair,
  calculateRoundPayout,
  calculateHandValue,
  createInitialGame,
  createSplitHands,
  dealerPlay,
  determineSplitHandWinner,
  isFiveCardCharlie,
  playerDoubleDown,
  playerHit,
  playerStand,
} from './logic'
import { drawCard } from '../shared/cardUtils'

const STARTING_CHIPS = 1000
const BET_INCREMENTS = [100, 500, 1000]

const scoreStore = useScoreStore()
const gameState = ref(null)
const chips = ref(STARTING_CHIPS)
const selectedBet = ref(100)
const roundBet = ref(0)
const roundPayout = ref(0)
const splitHands = ref([])
const activeHandIndex = ref(0)

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const resultContent = {
  [GAME_RESULTS.PLAYER_WIN]: {
    title: 'You beat the dealer',
    message: 'Your hand is closer to 21.',
  },
  [GAME_RESULTS.DEALER_WIN]: {
    title: 'House takes the round',
    message: 'The dealer finished with the stronger hand.',
  },
  [GAME_RESULTS.PUSH]: {
    title: 'It is a tie',
    message: 'Same value. Your bet is returned.',
  },
  [GAME_RESULTS.PLAYER_BUST]: {
    title: 'Over 21',
    message: 'Your hand went over the limit.',
  },
  [GAME_RESULTS.DEALER_BUST]: {
    title: 'You win the round',
    message: 'The dealer went over 21.',
  },
  [GAME_RESULTS.BLACKJACK]: {
    title: 'Blackjack!',
    message: 'Natural Blackjack pays 1.5 times your bet in winnings.',
  },
  [GAME_RESULTS.FIVE_CARD_CHARLIE]: {
    title: 'Five Card Charlie!',
    message: 'Five cards without going over 21 pays 2 times your bet in winnings.',
  },
}

const bestScore = computed(() => scoreStore.getBestScore('blackjack'))
const chipsAfterBet = computed(() =>
  Math.max(chips.value - Number(selectedBet.value || 0), 0),
)
const isPlayerTurn = computed(
  () => gameState.value?.status === GAME_STATUS.PLAYER_TURN,
)
const hasSplitHands = computed(() => splitHands.value.length > 0)
const activeSplitHand = computed(
  () => splitHands.value[activeHandIndex.value] ?? null,
)
const activeBet = computed(() =>
  hasSplitHands.value ? activeSplitHand.value?.bet ?? 0 : roundBet.value,
)
const canDoubleDown = computed(
  () =>
    isPlayerTurn.value &&
    (hasSplitHands.value
      ? activeSplitHand.value?.cards.length === 2
      : gameState.value?.playerHand.length === 2) &&
    chips.value >= activeBet.value,
)
const canSplit = computed(
  () =>
    isPlayerTurn.value &&
    !hasSplitHands.value &&
    canSplitPair(gameState.value?.playerHand ?? []) &&
    chips.value >= roundBet.value,
)
const roundResult = computed(() =>
  gameState.value?.result ? resultContent[gameState.value.result] : null,
)
const displayedHands = computed(() =>
  hasSplitHands.value
    ? splitHands.value
    : gameState.value
      ? [{ cards: gameState.value.playerHand, bet: roundBet.value }]
      : [],
)
const totalRoundBet = computed(() =>
  hasSplitHands.value
    ? splitHands.value.reduce((total, hand) => total + hand.bet, 0)
    : roundBet.value,
)
const dealerValue = computed(() => {
  if (!gameState.value) return 0
  if (isPlayerTurn.value) {
    return calculateHandValue([gameState.value.dealerHand[0]])
  }
  return calculateHandValue(gameState.value.dealerHand)
})

const splitRoundNet = computed(() => roundPayout.value - totalRoundBet.value)
const splitRoundTitle = computed(() => {
  if (splitRoundNet.value > 0) return 'Split round won'
  if (splitRoundNet.value < 0) return 'Dealer wins the split round'
  return 'Split round is even'
})

const resultEyebrow = computed(() => {
  const result = gameState.value?.result
  if (result === GAME_RESULTS.BLACKJACK) {
    return `Blackjack · won ${formatChips(roundBet.value * 1.5)} chips`
  }
  if (result === GAME_RESULTS.FIVE_CARD_CHARLIE) {
    return `Five Card Charlie · won ${formatChips(roundBet.value * 2)} chips`
  }
  if ([GAME_RESULTS.PLAYER_WIN, GAME_RESULTS.DEALER_BUST].includes(result)) {
    return `Round won · won ${formatChips(roundBet.value)} chips`
  }
  if (result === GAME_RESULTS.PUSH) {
    return `Push · ${formatChips(roundBet.value)} chips returned`
  }
  return `Round lost · lost ${formatChips(roundBet.value)} chips`
})

function applyCompletedRound(nextState, previousState = null) {
  const justFinished =
    nextState.status === GAME_STATUS.FINISHED &&
    previousState?.status !== GAME_STATUS.FINISHED

  if (justFinished) {
    roundPayout.value = calculateRoundPayout(nextState.result, roundBet.value)
    chips.value += roundPayout.value
    scoreStore.updateBestScore('blackjack', chips.value)
  }

  gameState.value = nextState
}

function startRound() {
  if (
    chips.value <= 0 ||
    selectedBet.value <= 0 ||
    selectedBet.value > chips.value
  ) {
    return
  }

  roundBet.value = selectedBet.value
  roundPayout.value = 0
  splitHands.value = []
  activeHandIndex.value = 0
  chips.value -= roundBet.value
  applyCompletedRound(createInitialGame())
}

function prepareNextRound() {
  gameState.value = null
  roundBet.value = 0
  roundPayout.value = 0
  splitHands.value = []
  activeHandIndex.value = 0

  if (selectedBet.value > chips.value) {
    selectedBet.value = chips.value
  }
}

function addToBet(amount) {
  selectedBet.value = Math.min(
    Math.max(Number(selectedBet.value) || 0, 0) + amount,
    chips.value,
  )
}

function normalizeSelectedBet() {
  const nextBet = Math.floor(Number(selectedBet.value))
  selectedBet.value = Number.isFinite(nextBet)
    ? Math.min(Math.max(nextBet, 0), chips.value)
    : 0
}

function setAllIn() {
  selectedBet.value = chips.value
}

function hit() {
  if (!gameState.value) return

  if (hasSplitHands.value) {
    const draw = drawCard(gameState.value.deck)
    if (!draw.card) return

    activeSplitHand.value.cards.push(draw.card)
    gameState.value.deck = draw.remainingDeck

    if (
      calculateHandValue(activeSplitHand.value.cards) >= 21 ||
      isFiveCardCharlie(activeSplitHand.value.cards)
    ) {
      finishActiveSplitHand()
    }
    return
  }

  applyCompletedRound(playerHit(gameState.value), gameState.value)
}

function stand() {
  if (!gameState.value) return
  if (hasSplitHands.value) {
    finishActiveSplitHand()
    return
  }
  applyCompletedRound(playerStand(gameState.value), gameState.value)
}

function doubleDown() {
  if (!gameState.value || !canDoubleDown.value) return

  if (hasSplitHands.value) {
    chips.value -= activeSplitHand.value.bet
    activeSplitHand.value.bet *= 2

    const draw = drawCard(gameState.value.deck)
    if (!draw.card) return
    activeSplitHand.value.cards.push(draw.card)
    gameState.value.deck = draw.remainingDeck
    finishActiveSplitHand()
    return
  }

  const previousState = gameState.value
  chips.value -= roundBet.value
  roundBet.value *= 2
  applyCompletedRound(playerDoubleDown(previousState), previousState)
}

function splitPair() {
  if (!gameState.value || !canSplit.value) return

  const split = createSplitHands(
    gameState.value.playerHand,
    gameState.value.deck,
  )
  if (!split) return

  chips.value -= roundBet.value
  splitHands.value = split.hands.map((cards) => ({
    cards,
    bet: roundBet.value,
    result: null,
  }))
  activeHandIndex.value = 0
  gameState.value = {
    ...gameState.value,
    deck: split.remainingDeck,
    playerHand: splitHands.value[0].cards,
  }

  if (splitHands.value.every((hand) => hand.cards[0].rank === 'A')) {
    settleSplitRound()
  }
}

function finishActiveSplitHand() {
  if (!activeSplitHand.value) return

  if (activeHandIndex.value < splitHands.value.length - 1) {
    activeHandIndex.value += 1
    gameState.value.playerHand = activeSplitHand.value.cards
    return
  }

  settleSplitRound()
}

function settleSplitRound() {
  const allHandsBust = splitHands.value.every(
    (hand) => calculateHandValue(hand.cards) > 21,
  )
  const dealerState = allHandsBust
    ? gameState.value
    : dealerPlay(gameState.value)

  let payout = 0
  splitHands.value.forEach((hand) => {
    hand.result = determineSplitHandWinner(
      hand.cards,
      dealerState.dealerHand,
    )
    payout += calculateRoundPayout(hand.result, hand.bet)
  })

  roundPayout.value = payout
  chips.value += payout
  gameState.value = {
    ...dealerState,
    status: GAME_STATUS.FINISHED,
    result: null,
  }
  scoreStore.updateBestScore('blackjack', chips.value)
}

function splitResultLabel(result) {
  if (result === GAME_RESULTS.PUSH) return 'Push'
  if (result === GAME_RESULTS.FIVE_CARD_CHARLIE) return 'Charlie'
  if ([GAME_RESULTS.PLAYER_WIN, GAME_RESULTS.DEALER_BUST].includes(result)) {
    return 'Win'
  }
  return 'Loss'
}

function resetChips() {
  if (chips.value !== 0) return
  chips.value = STARTING_CHIPS
  selectedBet.value = 100
  prepareNextRound()
  scoreStore.updateBestScore('blackjack', chips.value)
}

function formatChips(value) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })
}

function cardColorClass(card) {
  return ['hearts', 'diamonds'].includes(card.suit) ? 'playing-card--red' : ''
}

onMounted(() => {
  scoreStore.loadScores()
  scoreStore.updateBestScore('blackjack', chips.value)
})
</script>

<template>
  <div class="blackjack-page container">
    <div class="blackjack-nav">
      <RouterLink class="back-link" to="/">
        <span aria-hidden="true">←</span>
        Back to Home
      </RouterLink>
      <button
        v-if="chips === 0"
        class="blackjack-reset"
        type="button"
        @click="resetChips"
      >
        Reset Chips
      </button>
    </div>

    <section class="blackjack">
      <header class="blackjack__header">
        <div>
          <span class="game-kicker">Casino classic</span>
          <h1>Blackjack</h1>
          <p>Beat the dealer without going over 21.</p>
        </div>
        <ScoreBoard
          :score="chips"
          :best-score="bestScore"
          score-label="Chips"
          best-label="Highest chips"
          aria-label="Blackjack virtual chips"
        />
      </header>

      <div class="blackjack-table">
        <div class="table-light table-light--left"></div>
        <div class="table-light table-light--right"></div>

        <div class="virtual-chips-notice">
          Virtual chips only. No real money.
        </div>

        <section
          v-if="!gameState"
          class="bet-panel"
          aria-labelledby="bet-heading"
        >
          <template v-if="chips > 0">
            <span class="hand-heading__role">Before the deal</span>
            <h2 id="bet-heading">Choose your bet</h2>
            <p>Select how many chips to play this round.</p>

            <div class="bet-builder">
              <span class="bet-builder__label">Quick add</span>
              <div class="bet-increments" aria-label="Quickly add to bet">
                <button
                  v-for="amount in BET_INCREMENTS"
                  :key="amount"
                  class="bet-increment"
                  type="button"
                  :disabled="selectedBet >= chips"
                  @click="addToBet(amount)"
                >
                  <span aria-hidden="true">+</span>{{ formatChips(amount) }}
                </button>
              </div>

              <span class="bet-builder__label">Your bet</span>
              <div class="bet-custom">
                <label class="bet-input">
                  <span>Chips</span>
                  <input
                    v-model.number="selectedBet"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    :max="chips"
                    step="1"
                    aria-label="Custom bet in chips"
                    @change="normalizeSelectedBet"
                  />
                </label>
                <button
                  class="bet-all-in"
                  :class="{ 'bet-all-in--selected': selectedBet === chips }"
                  type="button"
                  @click="setAllIn"
                >
                  All in
                  <small>{{ formatChips(chips) }} chips</small>
                </button>
              </div>
            </div>

            <div class="bet-summary" aria-live="polite">
              <span>Bet</span>
              <strong>{{ formatChips(selectedBet || 0) }} chips</strong>
              <small>{{ formatChips(chipsAfterBet) }} chips remain after deal</small>
            </div>

            <button
              class="button button--primary bet-deal-button"
              type="button"
              :disabled="selectedBet <= 0 || selectedBet > chips"
              @click="startRound"
            >
              Deal with {{ formatChips(selectedBet || 0) }} chips
              <span aria-hidden="true">→</span>
            </button>
          </template>

          <template v-else>
            <span class="hand-heading__role">No chips remaining</span>
            <h2 id="bet-heading">Ready for a fresh stack?</h2>
            <p>
              Reset to {{ formatChips(STARTING_CHIPS) }} virtual chips to keep
              playing.
            </p>
            <button
              class="button button--primary bet-deal-button"
              type="button"
              @click="resetChips"
            >
              Reset Chips
              <span aria-hidden="true">↻</span>
            </button>
          </template>
        </section>

        <template v-else>
          <div class="current-bet" aria-label="Current bet">
            {{ hasSplitHands ? 'Total bet' : 'Bet' }}:
            <strong>{{ formatChips(totalRoundBet) }} chips</strong>
          </div>

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
            Dealer stands on 17 · Five Card Charlie pays 2:1
            <span></span>
          </div>

          <div
            class="player-hands"
            :class="{ 'player-hands--split': hasSplitHands }"
          >
            <section
              v-for="(hand, handIndex) in displayedHands"
              :key="handIndex"
              class="hand-area player-hand"
              :class="{
                'player-hand--active':
                  hasSplitHands &&
                  isPlayerTurn &&
                  activeHandIndex === handIndex,
                'player-hand--complete': hand.result,
              }"
              :aria-labelledby="`player-heading-${handIndex}`"
            >
              <div class="hand-heading">
                <div>
                  <span class="hand-heading__role">
                    {{ hasSplitHands ? `Hand ${handIndex + 1}` : 'Your hand' }}
                  </span>
                  <h2 :id="`player-heading-${handIndex}`">
                    {{ hasSplitHands ? `${formatChips(hand.bet)} chips` : 'Player' }}
                  </h2>
                </div>
                <div class="player-hand__status">
                  <span
                    v-if="hand.result"
                    class="split-result"
                    :class="`split-result--${splitResultLabel(hand.result).toLowerCase()}`"
                  >
                    {{ splitResultLabel(hand.result) }}
                  </span>
                  <span class="hand-value hand-value--player">
                    {{ calculateHandValue(hand.cards) }}
                  </span>
                </div>
              </div>

              <div class="card-hand">
                <div
                  v-for="card in hand.cards"
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
          </div>

          <div v-if="isPlayerTurn" class="blackjack-actions">
            <button
              class="button blackjack-button blackjack-button--hit"
              type="button"
              @click="hit"
            >
              Hit
              <span aria-hidden="true">＋</span>
            </button>
            <button
              class="button blackjack-button blackjack-button--double"
              type="button"
              :disabled="!canDoubleDown"
              :title="
                canDoubleDown
                  ? `Double bet to ${formatChips(activeBet * 2)} chips and draw one card`
                  : 'Double Down requires your first two cards and enough chips'
              "
              @click="doubleDown"
            >
              Double
              <span aria-hidden="true">×2</span>
            </button>
            <button
              class="button blackjack-button blackjack-button--split"
              type="button"
              :disabled="!canSplit"
              :title="
                canSplit
                  ? `Split pair into two ${formatChips(roundBet)} chip hands`
                  : 'Split requires a matching pair and enough chips'
              "
              @click="splitPair"
            >
              Split
              <span aria-hidden="true">⇄</span>
            </button>
            <button
              class="button blackjack-button blackjack-button--stand"
              type="button"
              @click="stand"
            >
              Stand
              <span aria-hidden="true">■</span>
            </button>
          </div>

          <div
            v-else-if="hasSplitHands"
            class="round-result"
            aria-live="polite"
          >
            <span>
              {{ splitRoundNet >= 0 ? 'Split round complete' : 'Split round lost' }}
            </span>
            <h2>{{ splitRoundTitle }}</h2>
            <div class="split-settlement">
              <div v-for="(hand, handIndex) in splitHands" :key="handIndex">
                <span>Hand {{ handIndex + 1 }}</span>
                <strong>{{ splitResultLabel(hand.result) }}</strong>
                <small>{{ formatChips(hand.bet) }} chips</small>
              </div>
            </div>
            <p class="round-result__balance">
              Balance: <strong>{{ formatChips(chips) }} chips</strong>
            </p>
            <button
              class="button button--primary"
              type="button"
              @click="prepareNextRound"
            >
              {{ chips > 0 ? 'Choose Next Bet' : 'Continue' }}
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div v-else class="round-result" aria-live="polite">
            <span>{{ resultEyebrow }}</span>
            <h2>{{ roundResult.title }}</h2>
            <p>{{ roundResult.message }}</p>
            <p class="round-result__balance">
              Balance: <strong>{{ formatChips(chips) }} chips</strong>
            </p>
            <button
              v-if="chips > 0"
              class="button button--primary"
              type="button"
              @click="prepareNextRound"
            >
              Choose Next Bet
              <span aria-hidden="true">→</span>
            </button>
            <button
              v-else
              class="button button--primary"
              type="button"
              @click="prepareNextRound"
            >
              Continue
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
