<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ScoreBoard from '../../components/ScoreBoard.vue'
import { useScoreStore } from '../../stores/scoreStore'
import {
  advanceTurn,
  assignSeats,
  calculateMahjongScore,
  claimDiscard,
  createSetupMahjongGame,
  declareAddedKong,
  declareConcealedKong,
  declareWin,
  determineDealerFromDice,
  discardTile,
  drawAfterKong,
  drawTile,
  getAvailableAddedKongs,
  getAvailableClaims,
  getAvailableConcealedKongs,
  passClaim,
  passRobKong,
  robKongWin,
  rollDice,
  startGameAfterDice,
} from './logic'
import { SCORING_MODES } from './scoring'

const scoreStore = useScoreStore()
const gameState = ref(null)
const score = ref(0)
const selectedTileIndex = ref(null)
const computerRunning = ref(false)
const scoringMode = ref(SCORING_MODES.SIMPLE)
let runToken = 0

const bestScore = computed(() => scoreStore.getBestScore('mahjong'))
const humanPlayer = computed(() => gameState.value?.players[0])
const currentPlayerName = computed(
  () => gameState.value?.players[gameState.value.currentPlayer]?.name ?? '',
)
const dealerPlayer = computed(() =>
  gameState.value?.players.find(
    (player) => player.id === gameState.value?.dealer,
  ),
)
const phaseLabel = computed(() =>
  gameState.value?.phase === 'waitingDraw'
    ? 'Waiting for draw'
    : gameState.value?.phase === 'claim'
      ? 'Waiting for claim'
      : gameState.value?.phase === 'waitingKongDraw'
        ? 'Waiting for replacement draw'
        : gameState.value?.phase === 'robKong'
          ? 'Waiting for rob kong'
      : 'Waiting for discard',
)
const humanClaims = computed(() => {
  if (!gameState.value?.claimPhase?.active) {
    return {
      canChi: false,
      chiOptions: [],
      canPong: false,
      canKong: false,
    }
  }
  return getAvailableClaims(gameState.value, 0)
})
const humanCanClaim = computed(
  () =>
    gameState.value?.claimPhase?.active &&
    gameState.value.claimPhase.eligiblePlayers.includes(0),
)
const canHumanDraw = computed(
  () =>
    gameState.value?.status === 'playing' &&
    gameState.value.currentPlayer === 0 &&
    gameState.value.phase === 'waitingDraw' &&
    !computerRunning.value,
)
const canHumanDiscard = computed(
  () =>
    gameState.value?.status === 'playing' &&
    gameState.value.currentPlayer === 0 &&
    gameState.value.phase === 'waitingDiscard' &&
    selectedTileIndex.value !== null &&
    !computerRunning.value,
)
const canHumanWin = computed(
  () =>
    gameState.value?.status === 'playing' &&
    gameState.value.currentPlayer === 0 &&
    gameState.value.canDeclareWin,
)
const selectedTile = computed(() =>
  selectedTileIndex.value === null
    ? null
    : humanPlayer.value?.hand[selectedTileIndex.value] ?? null,
)
const concealedKongOptions = computed(() => {
  if (
    gameState.value?.status !== 'playing' ||
    gameState.value.currentPlayer !== 0 ||
    gameState.value.phase !== 'waitingDiscard' ||
    !selectedTile.value
  ) {
    return []
  }
  return getAvailableConcealedKongs(humanPlayer.value.hand).filter((option) =>
    option.tiles.some((tile) => tile.id === selectedTile.value.id),
  )
})
const addedKongOptions = computed(() => {
  if (
    gameState.value?.status !== 'playing' ||
    gameState.value.currentPlayer !== 0 ||
    gameState.value.phase !== 'waitingDiscard' ||
    !selectedTile.value
  ) {
    return []
  }
  return getAvailableAddedKongs(humanPlayer.value).filter(
    (option) => option.tile.id === selectedTile.value.id,
  )
})
const canHumanDrawAfterKong = computed(
  () =>
    gameState.value?.status === 'playing' &&
    gameState.value.phase === 'waitingKongDraw' &&
    gameState.value.kongDrawPending?.active &&
    gameState.value.kongDrawPending.playerIndex === 0 &&
    !computerRunning.value,
)
const humanCanRobKong = computed(
  () =>
    gameState.value?.robKongPhase?.active &&
    gameState.value.robKongPhase.eligiblePlayers.includes(0) &&
    !gameState.value.robKongPhase.passedPlayers.includes(0),
)

const suitClass = {
  characters: 'tile-characters',
  dots: 'tile-dots',
  bamboo: 'tile-bamboo',
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

function applyResult(result, previousStatus = gameState.value?.status) {
  gameState.value = result.gameState

  if (previousStatus === 'playing' && result.gameState.status === 'win') {
    const gained = calculateMahjongScore(
      result.gameState,
      result.gameState.winner?.id,
    )
    score.value += gained
    scoreStore.updateBestScore('mahjong', score.value)
  }
}

function newGame() {
  runToken += 1
  computerRunning.value = false
  selectedTileIndex.value = null
  gameState.value = createSetupMahjongGame(scoringMode.value)
}

function updateScoringMode() {
  if (gameState.value) {
    gameState.value.scoringMode = scoringMode.value
  }
}

function rollSetupDice() {
  if (gameState.value?.status !== 'setup') return

  const dice = rollDice()
  const dealer = determineDealerFromDice(dice.total)
  const players = assignSeats(gameState.value.players, dealer)
  gameState.value = {
    ...gameState.value,
    players,
    dealer,
    dice,
    setupPhase: 'ready',
    seatAssignments: players.map((player) => ({
      playerId: player.id,
      seat: player.seat,
    })),
    message: `${players[dealer].name} will be East and the dealer.`,
  }
}

async function startSetupGame() {
  if (gameState.value?.setupPhase !== 'ready') return
  gameState.value = startGameAfterDice(gameState.value)
  await runComputerPlayers()
}

function resetScore() {
  score.value = 0
}

function selectTile(index) {
  if (
    gameState.value.status !== 'playing' ||
    gameState.value.currentPlayer !== 0 ||
    gameState.value.phase !== 'waitingDiscard'
  ) {
    return
  }

  selectedTileIndex.value = selectedTileIndex.value === index ? null : index
}

function humanDraw() {
  if (!canHumanDraw.value) return
  applyResult(drawTile(gameState.value))
}

async function humanDiscard() {
  if (!canHumanDiscard.value) return

  const result = discardTile(gameState.value, 0, selectedTileIndex.value)
  applyResult(result)
  if (!result.success) return

  selectedTileIndex.value = null
  await runComputerPlayers()
}

function humanClaim(claimType, chiOption = null) {
  if (!humanCanClaim.value) return
  applyResult(claimDiscard(gameState.value, 0, claimType, chiOption))
}

function humanConcealedKong(tileKey) {
  applyResult(declareConcealedKong(gameState.value, 0, tileKey))
  selectedTileIndex.value = null
}

async function humanAddedKong(tileKey) {
  const result = declareAddedKong(gameState.value, 0, tileKey)
  applyResult(result)
  selectedTileIndex.value = null
  if (result.success && result.gameState.robKongPhase.active) {
    await runComputerPlayers()
  }
}

function humanDrawAfterKong() {
  if (!canHumanDrawAfterKong.value) return
  applyResult(drawAfterKong(gameState.value))
}

function humanRobKongWin() {
  if (!humanCanRobKong.value) return
  applyResult(robKongWin(gameState.value, 0))
}

async function humanPassRobKong() {
  if (!humanCanRobKong.value) return
  const result = passRobKong(gameState.value, 0)
  applyResult(result)
  if (result.success) await runComputerPlayers()
}

async function humanPassClaim() {
  if (!humanCanClaim.value) return
  const result = passClaim(gameState.value, 0)
  applyResult(result)
  if (result.success) await runComputerPlayers()
}

function humanWin() {
  if (!canHumanWin.value) return
  applyResult(declareWin(gameState.value, 0))
}

async function runComputerPlayers() {
  if (computerRunning.value || gameState.value.status !== 'playing') return

  computerRunning.value = true
  const currentRun = ++runToken

  for (let step = 0; step < 12; step += 1) {
    if (
      currentRun !== runToken ||
      gameState.value.status !== 'playing'
    ) {
      break
    }

    if (
      gameState.value.claimPhase.active &&
      gameState.value.claimPhase.eligiblePlayers.includes(0) &&
      !gameState.value.claimPhase.claims.some(
        (claim) => claim.playerIndex === 0,
      )
    ) {
      break
    }

    if (
      gameState.value.robKongPhase.active &&
      gameState.value.robKongPhase.eligiblePlayers.includes(0) &&
      !gameState.value.robKongPhase.passedPlayers.includes(0)
    ) {
      break
    }

    if (
      !gameState.value.claimPhase.active &&
      !gameState.value.robKongPhase.active &&
      gameState.value.players[gameState.value.currentPlayer].isHuman
    ) {
      break
    }

    await delay(360)
    if (currentRun !== runToken) break

    const result = advanceTurn(gameState.value)
    applyResult(result)
    if (!result.success && result.gameState === gameState.value) break
  }

  if (currentRun === runToken) computerRunning.value = false
}

function playerPanelClass(player) {
  return {
    'mahjong-player--current':
      gameState.value.status === 'playing' &&
      gameState.value.currentPlayer === player.id,
    'mahjong-player--winner': gameState.value.winner?.id === player.id,
  }
}

function tileSuitClass(tile) {
  return suitClass[tile.suit]
}

function getTileImage(tile) {
  return `/mahjong/${tile.suit}-${tile.rank}.svg`
}

function diceFace(value) {
  return ['?', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][value] ?? '?'
}

function chiOptionLabel(option) {
  return option.meldTiles.map((tile) => tile.label).join(' · ')
}

function meldLabel(meld) {
  if (meld.type !== 'kong') return meld.type
  return `${meld.kongType ?? 'exposed'} kong`
}

function shouldHideMeldTile(player, meld) {
  return meld.concealed && !player.isHuman
}

function seatClass(player) {
  return [
    'mahjong-seat',
    player.isHuman ? 'mahjong-seat-human' : '',
    player.id === 1 ? 'mahjong-seat-right' : '',
    player.id === 2 ? 'mahjong-seat-top' : '',
    player.id === 3 ? 'mahjong-seat-left' : '',
  ]
}

onMounted(() => {
  scoreStore.loadScores()
  newGame()
})

onBeforeUnmount(() => {
  runToken += 1
})
</script>

<template>
  <div class="mahjong-page container">
    <div class="mahjong-nav">
      <RouterLink class="back-link" to="/">
        <span aria-hidden="true">←</span>
        Back to Home
      </RouterLink>

      <div class="mahjong-nav__actions">
        <label class="mahjong-scoring-mode">
          <span>Scoring Mode</span>
          <select
            v-model="scoringMode"
            :disabled="gameState?.status === 'win'"
            @change="updateScoringMode"
          >
            <option :value="SCORING_MODES.SIMPLE">Simple</option>
            <option :value="SCORING_MODES.TAIWAN_COMMON">
              Taiwan Common
            </option>
          </select>
        </label>
        <button class="mahjong-reset" type="button" @click="resetScore">
          Reset Score
        </button>
        <button class="button mahjong-new-game" type="button" @click="newGame">
          <span aria-hidden="true">↻</span>
          New Game
        </button>
      </div>
    </div>

    <section v-if="gameState" class="mahjong">
      <header class="mahjong__header">
        <div>
          <span class="game-kicker">Four-player table</span>
          <h1>Four-Player Mahjong</h1>
          <p>Simplified 16-tile Mahjong against three computer players.</p>
        </div>
        <ScoreBoard :score="score" :best-score="bestScore" />
      </header>

      <section
        v-if="gameState.status === 'setup'"
        class="mahjong-setup"
        aria-live="polite"
      >
        <span class="game-kicker">Table setup</span>
        <h2>Roll Dice to Decide Dealer</h2>
        <p>Two dice decide the East seat. The remaining seats follow counterclockwise.</p>

        <div class="mahjong-setup-players">
          <div
            v-for="player in gameState.players"
            :key="`setup-${player.id}`"
            :class="{ 'mahjong-setup-player--dealer': player.id === gameState.dealer }"
          >
            <span>{{ player.name }}</span>
            <strong>
              {{ gameState.setupPhase === 'ready' ? player.seat : 'Waiting' }}
            </strong>
          </div>
        </div>

        <div class="mahjong-dice-area">
          <div class="mahjong-dice" aria-label="Dice result">
            <template v-if="gameState.dice.values.length">
              <span
                v-for="(value, diceIndex) in gameState.dice.values"
                :key="diceIndex"
                class="mahjong-die"
                :aria-label="`Die ${diceIndex + 1}: ${value}`"
              >
                {{ diceFace(value) }}
              </span>
            </template>
            <template v-else>
              <span
                v-for="placeholder in 2"
                :key="`placeholder-${placeholder}`"
                class="mahjong-die mahjong-die--empty"
                aria-hidden="true"
              >
                ?
              </span>
            </template>
          </div>

          <div v-if="gameState.dice.total" class="mahjong-dice-result">
            <span>Total {{ gameState.dice.total }}</span>
            <strong>{{ dealerPlayer.name }} is East / Dealer</strong>
          </div>
          <p v-else>{{ gameState.message }}</p>
        </div>

        <div class="mahjong-setup-actions">
          <button
            class="button mahjong-roll-button"
            type="button"
            @click="rollSetupDice"
          >
            Roll Dice
          </button>
          <button
            class="button button--primary"
            type="button"
            :disabled="gameState.setupPhase !== 'ready'"
            @click="startSetupGame"
          >
            Start Game
          </button>
        </div>
      </section>

      <template v-else>
      <div class="mahjong-status-bar">
        <div>
          <span>Current Player</span>
          <strong>{{ currentPlayerName }}</strong>
        </div>
        <div>
          <span>Phase</span>
          <strong>{{ computerRunning ? 'Computer thinking' : phaseLabel }}</strong>
        </div>
        <div>
          <span>Wall Remaining</span>
          <strong>{{ gameState.wall.length }}</strong>
        </div>
        <div>
          <span>Moves</span>
          <strong>{{ gameState.moves }}</strong>
        </div>
      </div>

      <div
        class="mahjong-message"
        :class="{
          'mahjong-message--win': gameState.status === 'win',
          'mahjong-message--draw': gameState.status === 'draw',
        }"
        aria-live="polite"
      >
        <span aria-hidden="true">{{ gameState.status === 'playing' ? '●' : '◆' }}</span>
        {{ gameState.message }}
      </div>

      <section v-if="humanCanClaim" class="mahjong-claim-bar" aria-live="polite">
        <div class="mahjong-claim-tile">
          <span>Claim Tile</span>
          <div class="mahjong-claim-tile__image">
            <img
              :src="getTileImage(gameState.claimPhase.discardedTile)"
              :alt="gameState.claimPhase.discardedTile.label"
              class="mahjong-tile-img"
            />
          </div>
        </div>

        <div class="mahjong-claim-content">
          <div class="mahjong-claim-actions">
            <button
              class="button mahjong-claim-button"
              type="button"
              :disabled="!humanClaims.canChi"
              @click="humanClaim('chi', humanClaims.chiOptions[0])"
            >
              Chi
            </button>
            <button
              class="button mahjong-claim-button"
              type="button"
              :disabled="!humanClaims.canPong"
              @click="humanClaim('pong')"
            >
              Pong
            </button>
            <button
              class="button mahjong-claim-button mahjong-claim-button--kong"
              type="button"
              :disabled="!humanClaims.canKong"
              @click="humanClaim('kong')"
            >
              Kong
            </button>
            <button
              class="button mahjong-claim-button mahjong-claim-button--pass"
              type="button"
              @click="humanPassClaim"
            >
              Pass
            </button>
          </div>

          <div v-if="humanClaims.canChi" class="mahjong-claim-options">
            <span>Choose Chi</span>
            <button
              v-for="(option, optionIndex) in humanClaims.chiOptions"
              :key="optionIndex"
              type="button"
              @click="humanClaim('chi', option)"
            >
              {{ chiOptionLabel(option) }}
            </button>
          </div>
        </div>
      </section>

      <section
        v-if="humanCanRobKong"
        class="mahjong-rob-kong-bar"
        aria-live="assertive"
      >
        <div class="mahjong-claim-tile">
          <span>Added Kong</span>
          <div class="mahjong-claim-tile__image">
            <img
              :src="getTileImage(gameState.robKongPhase.addedTile)"
              :alt="gameState.robKongPhase.addedTile.label"
              class="mahjong-tile-img"
            />
          </div>
        </div>
        <div>
          <strong>You can win by robbing this kong.</strong>
          <div class="mahjong-claim-actions">
            <button
              class="button mahjong-button mahjong-button--win"
              type="button"
              @click="humanRobKongWin"
            >
              Rob Kong Win
            </button>
            <button
              class="button mahjong-claim-button mahjong-claim-button--pass"
              type="button"
              @click="humanPassRobKong"
            >
              Pass
            </button>
          </div>
        </div>
      </section>

      <div class="mahjong-scroll" aria-label="Scrollable Mahjong table">
        <div class="mahjong-table">
          <article
            v-for="player in gameState.players"
            :key="player.id"
            class="mahjong-player"
            :class="[
              `mahjong-player--seat-${player.id}`,
              seatClass(player),
              playerPanelClass(player),
            ]"
          >
            <header class="mahjong-player__header">
              <div>
                <span>{{ player.seat }}</span>
                <h2>
                  {{ player.name }}
                  <small
                    v-if="player.id === gameState.dealer"
                    class="mahjong-dealer-badge"
                  >
                    Dealer
                  </small>
                </h2>
              </div>
              <span class="mahjong-player__count">{{ player.hand.length }} tiles</span>
            </header>

            <div v-if="!player.isHuman" class="mahjong-computer-hand" aria-hidden="true">
              <img
                v-for="backIndex in Math.min(player.hand.length, 10)"
                :key="backIndex"
                src="/mahjong/tile-back.svg"
                alt="tile back"
                class="mahjong-tile-back mahjong-tile-img"
              />
            </div>

            <div class="mahjong-flowers mahjong-flower-zone">
              <span class="mahjong-flower-label">Flowers</span>
              <div>
                <span
                  v-if="player.flowerTiles.length === 0"
                  class="mahjong-zone-empty"
                >
                  No flowers
                </span>
                <span
                  v-for="tile in player.flowerTiles"
                  :key="tile.id"
                  class="mahjong-mini-tile mahjong-tile-small mahjong-flower-tile"
                >
                  <img
                    :src="getTileImage(tile)"
                    :alt="tile.label"
                    class="mahjong-tile-img"
                  />
                </span>
              </div>
            </div>

            <div class="mahjong-melds mahjong-meld-zone">
              <span class="mahjong-meld-zone__label">Melds</span>
              <span
                v-if="player.melds.length === 0"
                class="mahjong-zone-empty"
              >
                No melds
              </span>
              <div
                v-for="(meld, meldIndex) in player.melds"
                :key="`${meld.type}-${meldIndex}`"
                class="mahjong-meld"
                :class="{
                  'mahjong-meld-concealed': meld.kongType === 'concealed',
                  'mahjong-meld-added': meld.kongType === 'added',
                  'mahjong-meld-exposed': meld.kongType === 'exposed',
                }"
              >
                <span class="mahjong-meld-label">{{ meldLabel(meld) }}</span>
                <div class="mahjong-meld-tiles">
                  <span
                    v-for="tile in meld.tiles"
                    :key="tile.id"
                    class="mahjong-mini-tile mahjong-tile-small"
                  >
                    <img
                      :src="shouldHideMeldTile(player, meld)
                        ? '/mahjong/tile-back.svg'
                        : getTileImage(tile)"
                      :alt="shouldHideMeldTile(player, meld) ? 'concealed tile' : tile.label"
                      class="mahjong-tile-img"
                    />
                  </span>
                </div>
              </div>
            </div>

            <div class="mahjong-discards mahjong-discard-zone">
              <span v-if="player.discardPile.length === 0" class="mahjong-discards__empty">
                No discards
              </span>
              <span
                v-for="tile in player.discardPile"
                :key="tile.id"
                class="mahjong-mini-tile mahjong-tile-small"
                :class="tileSuitClass(tile)"
                :title="tile.label"
              >
                <img
                  :src="getTileImage(tile)"
                  :alt="tile.label"
                  class="mahjong-tile-img"
                />
              </span>
            </div>
          </article>

          <div class="mahjong-wall-center mahjong-center">
            <div class="mahjong-wall-info">
              <span>Wall</span>
              <strong>{{ gameState.wall.length }}</strong>
              <small>tiles remaining</small>
            </div>
            <i aria-hidden="true">東</i>
          </div>

          <section class="mahjong-human-area">
            <div class="mahjong-human-hand mahjong-hand" aria-label="Your Mahjong hand">
              <button
                v-for="(tile, tileIndex) in humanPlayer.hand"
                :key="tile.id"
                class="mahjong-tile"
                :class="[
                  tileSuitClass(tile),
                  {
                    'mahjong-tile--selected mahjong-tile-selected':
                      selectedTileIndex === tileIndex,
                  },
                ]"
                type="button"
                :aria-pressed="selectedTileIndex === tileIndex"
                :aria-label="tile.label"
                @click="selectTile(tileIndex)"
              >
                <img
                  :src="getTileImage(tile)"
                  :alt="tile.label"
                  class="mahjong-tile-img"
                />
              </button>
            </div>

            <div class="mahjong-controls">
              <button
                class="button mahjong-button mahjong-button--draw"
                type="button"
                :disabled="!canHumanDraw"
                @click="humanDraw"
              >
                Draw Tile
              </button>
              <button
                class="button mahjong-button mahjong-button--discard"
                type="button"
                :disabled="!canHumanDiscard"
                @click="humanDiscard"
              >
                Discard Selected
              </button>
              <button
                v-if="canHumanDrawAfterKong"
                class="button mahjong-button mahjong-replacement-draw"
                type="button"
                @click="humanDrawAfterKong"
              >
                Draw Replacement Tile
              </button>
              <button
                v-if="canHumanWin"
                class="button mahjong-button mahjong-button--win"
                type="button"
                @click="humanWin"
              >
                Win
              </button>
            </div>

            <div
              v-if="concealedKongOptions.length || addedKongOptions.length"
              class="mahjong-kong-actions"
            >
              <div
                v-for="option in concealedKongOptions"
                :key="`concealed-${option.tileKey}`"
                class="mahjong-kong-option"
              >
                <img
                  :src="getTileImage(option.tiles[0])"
                  :alt="option.tiles[0].label"
                  class="mahjong-tile-img"
                />
                <button type="button" @click="humanConcealedKong(option.tileKey)">
                  Concealed Kong
                </button>
              </div>
              <div
                v-for="option in addedKongOptions"
                :key="`added-${option.tileKey}`"
                class="mahjong-kong-option mahjong-kong-option--added"
              >
                <img
                  :src="getTileImage(option.tile)"
                  :alt="option.tile.label"
                  class="mahjong-tile-img"
                />
                <button type="button" @click="humanAddedKong(option.tileKey)">
                  Added Kong
                </button>
              </div>
            </div>
          </section>

          <div v-if="gameState.status !== 'playing'" class="mahjong-result">
            <span>{{ gameState.status === 'win' ? 'Hand complete' : 'Wall exhausted' }}</span>
            <h2>
              {{ gameState.status === 'win' ? `${gameState.winner.name} Wins` : 'Draw Game' }}
            </h2>
            <p v-if="gameState.status === 'win'">
              {{ gameState.winner.seat }} seat completed five melds and a pair.
            </p>
            <p v-else>No player completed a winning hand.</p>

            <section class="mahjong-result-hands">
              <h3>Final Hands</h3>
              <div
                v-for="player in gameState.players"
                :key="`result-hand-${player.id}`"
                class="mahjong-result-hand"
              >
                <header>
                  <strong>{{ player.name }}</strong>
                  <span>{{ player.seat }} · {{ player.hand.length }} tiles</span>
                </header>
                <div class="mahjong-result-hand__tiles">
                  <span
                    v-for="tile in player.hand"
                    :key="tile.id"
                    class="mahjong-mini-tile mahjong-tile-small"
                    :title="tile.label"
                  >
                    <img
                      :src="getTileImage(tile)"
                      :alt="tile.label"
                      class="mahjong-tile-img"
                    />
                  </span>
                </div>
                <div
                  v-if="player.flowerTiles.length"
                  class="mahjong-result-hand__flowers"
                >
                  <span>Flowers</span>
                  <div>
                    <span
                      v-for="tile in player.flowerTiles"
                      :key="`result-flower-${tile.id}`"
                      class="mahjong-mini-tile mahjong-tile-small mahjong-flower-tile"
                    >
                      <img
                        :src="getTileImage(tile)"
                        :alt="tile.label"
                        class="mahjong-tile-img"
                      />
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section
              v-if="gameState.status === 'win' && gameState.scoringResult"
              class="mahjong-scoring-panel"
            >
              <div class="mahjong-scoring-panel__mode">
                Scoring Mode:
                <strong>
                  {{ gameState.scoringResult.mode === SCORING_MODES.TAIWAN_COMMON
                    ? 'Taiwan Common'
                    : 'Simple' }}
                </strong>
              </div>
              <header>
                <span>Winner</span>
                <strong>{{ gameState.winner.name }}</strong>
                <span>Total Tai</span>
                <strong>{{ gameState.scoringResult.totalTai }}</strong>
              </header>

              <div>
                <h3>Patterns</h3>
                <ul class="mahjong-pattern-list">
                  <li
                    v-for="pattern in gameState.scoringResult.patterns"
                    :key="pattern.key"
                  >
                    <span>{{ pattern.name }}</span>
                    <strong>+{{ pattern.tai }}</strong>
                  </li>
                </ul>
              </div>

              <div>
                <h3>Payments</h3>
                <ul class="mahjong-payment-list">
                  <li
                    v-for="payment in gameState.scoringResult.payments"
                    :key="payment.playerIndex"
                  >
                    <span>{{ gameState.players[payment.playerIndex].name }}</span>
                    <strong
                      :class="{
                        'mahjong-payment-positive': payment.delta > 0,
                        'mahjong-payment-negative': payment.delta < 0,
                      }"
                    >
                      {{ payment.delta > 0 ? '+' : '' }}{{ payment.delta }}
                    </strong>
                  </li>
                </ul>
              </div>
            </section>

            <button class="button button--primary" type="button" @click="newGame">
              New Game
            </button>
          </div>
        </div>
      </div>
      </template>
    </section>
  </div>
</template>
