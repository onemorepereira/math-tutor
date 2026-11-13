<template>
  <div class="game-view">
    <!-- Always mounted so screen readers announce changes to its text -->
    <div class="sr-only" role="status" aria-live="polite" data-test="announcer">{{ announcement }}</div>

    <div v-if="isLoading && !currentProblem" class="loading">
      Loading your math problems
    </div>

    <div v-else-if="currentProblem && currentSession" class="game-container">
      <div class="game-header">
        <div class="progress-info">
          <div class="progress-title">
            <button type="button" class="btn-exit" aria-label="Exit game" data-test="exit" @click="exitGame">
              ✕ Exit
            </button>
            <h3 data-test="problem-number">Problem {{ problemNumber }} of {{ totalProblems }}</h3>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              data-test="progress-fill"
              :style="{ width: `${(answered / totalProblems) * 100}%` }"
            ></div>
          </div>
        </div>

        <div class="game-stats">
          <div class="stat">
            <span class="stat-label">Score:</span>
            <span class="stat-value" :class="{ 'score-pop': scorePopping }">{{ currentSession.totalScore || 0 }}</span>
          </div>
          <div v-if="streak >= 2" class="stat streak" data-test="header-streak" :aria-label="`${streak} correct in a row`">
            🔥 {{ streak }}
          </div>
        </div>
      </div>

      <div class="problem-card card">
        <div class="problem-content">
          <div class="problem-meta">
            <span class="problem-topic">{{ currentProblem.topic }}</span>
            <span class="problem-points" data-test="points-chip">⭐ {{ currentProblem.maxPoints }} pts</span>
          </div>
          <h2 class="problem-question">{{ currentProblem.question }}</h2>

          <div v-if="hintsReceived.length > 0 || missingHintCount > 0" class="hints-section">
            <h4>Hints:</h4>
            <p v-if="missingHintCount > 0" class="hint-item" data-test="used-hints">
              {{ hintPenaltyLine(hintsUsedCount) }}
            </p>
            <div v-for="hint in hintsReceived" :key="hint.hintNumber" class="hint-item">
              <strong>Hint {{ hint.hintNumber }}:</strong> {{ hint.content }}
              <span class="hint-penalty">(-{{ hint.pointDeduction }} points)</span>
            </div>
          </div>

          <div v-if="!feedback" class="answer-section">
            <div v-if="submitError" class="error-message" role="alert">{{ submitError }}</div>
            <div class="form-group">
              <label for="answer">Your Answer:</label>
              <input
                id="answer"
                ref="answerInput"
                v-model="userAnswer"
                type="text"
                inputmode="text"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                autocomplete="off"
                placeholder="Enter your answer"
                aria-describedby="answer-tip"
                @keyup.enter="handleSubmit"
                :disabled="isSubmitting"
              />
              <p id="answer-tip" class="format-tip" data-test="format-tip">{{ formatTip(currentProblem) }}</p>
            </div>

            <div class="action-buttons">
              <button
                type="button"
                @click="handleHintRequest"
                class="btn btn-secondary"
                data-test="hint-button"
                :disabled="!canRequestHint || isLoading"
              >
                <span v-if="isLoading && !isSubmitting">
                  <span class="spinner"></span>
                  Getting hint...
                </span>
                <span v-else>
                  💡 Hint −{{ HINT_COST }} pts · {{ 2 - hintsUsedCount }} left
                </span>
              </button>

              <button
                type="button"
                @click="handleSubmit"
                class="btn btn-primary"
                data-test="submit"
                :disabled="!userAnswer.trim() || isSubmitting || isLoading"
              >
                <span v-if="isSubmitting">
                  <span class="spinner"></span>
                  Submitting...
                </span>
                <span v-else>Submit Answer</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="feedback"
        ref="feedbackCard"
        class="feedback-card card"
        :class="feedback.kind === 'correct' ? 'success' : 'error'"
        data-test="feedback"
        tabindex="0"
        @keyup.enter.self="handleNextProblem"
      >
        <template v-if="feedback.kind === 'correct'">
          <h3>{{ feedback.title }} <span aria-hidden="true">🎉</span></h3>
          <p v-if="feedback.pointsEarned > 0" class="feedback-detail">
            +{{ feedback.pointsEarned }} points
            <span v-if="feedback.streak >= 2" data-test="feedback-streak"> · 🔥 {{ feedback.streak }} in a row</span>
          </p>
          <p v-else class="feedback-detail">The hints used up this one's points, but you solved it 💪</p>
        </template>

        <template v-else>
          <h3>Not quite right</h3>
          <dl class="answer-compare">
            <div>
              <dt>You said</dt>
              <dd data-test="you-said">{{ feedback.userAnswer }}</dd>
            </div>
            <div>
              <dt>Answer</dt>
              <dd data-test="right-answer">{{ feedback.correctAnswer }}</dd>
            </div>
          </dl>
          <ProblemExplanation :problem-id="feedback.problemId" />
        </template>

        <button type="button" @click="handleNextProblem" class="btn btn-primary" data-test="next">
          {{ answered >= totalProblems ? 'View Scorecard' : 'Next Problem' }}
        </button>
        <p class="hint-text">Press Enter to continue</p>
      </div>

      <LeaveGameDialog :open="leaveDialogOpen" @leave="confirmLeave" @stay="cancelLeave" />
    </div>

    <div v-else class="load-failure card" data-test="load-failure">
      <p>We couldn't load your game.</p>
      <button type="button" class="btn btn-primary" @click="router.push({ name: 'home' })">Back to Home</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import ProblemExplanation from '@/components/ProblemExplanation.vue'
import LeaveGameDialog from '@/components/LeaveGameDialog.vue'
import {
  HINT_COST,
  formatTip,
  praiseFor,
  currentStreak,
  displayedProblemNumber,
  answeredCount,
  hintPenaltyLine
} from '@/utils/gameFeedback'

interface Feedback {
  kind: 'correct' | 'wrong'
  title: string
  pointsEarned: number
  streak: number
  userAnswer: string
  correctAnswer: string
  problemId: string
}

const router = useRouter()
const gameStore = useGameStore()

const userAnswer = ref('')
const isSubmitting = ref(false)
const feedback = ref<Feedback | null>(null)
const submitError = ref<string | null>(null)
const announcement = ref('')
const feedbackCard = ref<HTMLDivElement | null>(null)
const answerInput = ref<HTMLInputElement | null>(null)
const scorePopping = ref(false)
const leaveDialogOpen = ref(false)
let leaveConfirmed = false
let pendingLeave: string | null = null
let scorePopTimeout: number | null = null

const currentProblem = computed(() => gameStore.currentProblem)
const currentSession = computed(() => gameStore.currentSession)
const totalProblems = computed(() => gameStore.totalProblems)
const isLoading = computed(() => gameStore.isLoading)
const canRequestHint = computed(() => gameStore.canRequestHint)
const hintsUsedCount = computed(() => gameStore.hintsUsedCount)
const hintsReceived = computed(() => gameStore.hintsReceived)

const problemNumber = computed(() =>
  currentSession.value ? displayedProblemNumber(currentSession.value, currentProblem.value) : 0
)
const answered = computed(() => answeredCount(currentSession.value))
const streak = computed(() => currentStreak(currentSession.value?.attempts ?? []))
// Hints recorded server-side whose text is gone (the game was resumed)
const missingHintCount = computed(() => Math.max(0, hintsUsedCount.value - hintsReceived.value.length))

onMounted(async () => {
  const session = currentSession.value
  if (!session) {
    router.push({ name: 'home' })
    return
  }

  // Left while a problem's feedback was showing: its answer is recorded, so
  // continue with the next problem instead of offering it again
  const problem = currentProblem.value
  if (problem && session.attempts.some((a) => a.problemId === problem.id)) {
    try {
      await gameStore.loadNextProblem()
    } catch {
      // The load-failure state below offers a way home
    }
    if (gameStore.scorecard) {
      router.push({ name: 'scorecard' })
      return
    }
  } else {
    gameStore.restartProblemClock()
  }

  await nextTick()
  answerInput.value?.focus()
})

// Every way out of an unfinished game (Exit, the logo, browser back) asks first
onBeforeRouteLeave((to) => {
  if (to.name === 'scorecard' || to.name === 'login') return true
  const session = gameStore.currentSession
  if (!session || session.isCompleted || !gameStore.currentProblem || leaveConfirmed) return true

  pendingLeave = to.fullPath
  leaveDialogOpen.value = true
  return false
})

function exitGame() {
  router.push({ name: 'home' })
}

function confirmLeave() {
  leaveDialogOpen.value = false
  leaveConfirmed = true
  // Replace, so Back from Home doesn't land on the game again
  router.replace(pendingLeave ?? { name: 'home' })
}

async function cancelLeave() {
  leaveDialogOpen.value = false
  pendingLeave = null
  await nextTick()
  if (feedback.value) feedbackCard.value?.focus()
  else answerInput.value?.focus()
}

// Briefly pop the score when it changes
watch(() => currentSession.value?.totalScore, (newScore, oldScore) => {
  if (newScore === undefined || oldScore === undefined || newScore === oldScore) return
  scorePopping.value = true
  if (scorePopTimeout !== null) clearTimeout(scorePopTimeout)
  scorePopTimeout = window.setTimeout(() => {
    scorePopping.value = false
  }, 700)
})

async function handleHintRequest() {
  try {
    const hint = await gameStore.requestHint()
    if (hint) {
      feedback.value = null
      announcement.value = `Hint ${hint.hintNumber}: ${hint.content}`
    }
  } catch (error) {
    console.error('Failed to get hint:', error)
  }
  await nextTick()
  answerInput.value?.focus()
}

async function handleSubmit() {
  const answer = userAnswer.value
  if (!answer.trim()) return

  const problem = currentProblem.value
  isSubmitting.value = true
  feedback.value = null
  submitError.value = null

  try {
    const result = await gameStore.submitAnswer(answer)

    if (!result || !problem) {
      return
    }

    const attempts = currentSession.value?.attempts ?? []
    if (result.isCorrect) {
      const title = praiseFor(Math.max(0, attempts.length - 1))
      const currentRun = currentStreak(attempts)
      feedback.value = {
        kind: 'correct',
        title,
        pointsEarned: result.pointsEarned,
        streak: currentRun,
        userAnswer: answer,
        correctAnswer: result.correctAnswer,
        problemId: problem.id
      }
      announcement.value = result.pointsEarned > 0
        ? `${title} +${result.pointsEarned} points`
        : `${title} The hints used up this one's points, but you solved it.`
    } else {
      feedback.value = {
        kind: 'wrong',
        title: 'Not quite right',
        pointsEarned: 0,
        streak: 0,
        userAnswer: answer,
        correctAnswer: result.correctAnswer,
        problemId: problem.id
      }
      announcement.value = `Not quite right. The answer is ${result.correctAnswer}.`
    }

    // Focus the feedback card so Enter advances to the next problem
    await nextTick()
    feedbackCard.value?.focus()
  } catch (error: any) {
    console.error('Failed to submit answer:', error)
    if (error?.response?.status === 409) {
      // The server already has an answer for this problem (e.g. the response
      // to an earlier submit was lost): resync instead of replaying it
      await resyncWithServer()
    } else {
      // Keep the form and the typed answer so the player can simply retry;
      // the inline message replaces the generic toast for this failure
      submitError.value = 'Your answer could not be sent. Please try again.'
      gameStore.error = null
    }
  } finally {
    isSubmitting.value = false
  }
}

async function resyncWithServer() {
  const sessionId = currentSession.value?.sessionId
  if (!sessionId) return
  try {
    await gameStore.resumeSession(sessionId)
    userAnswer.value = ''
    if (gameStore.scorecard) {
      router.push({ name: 'scorecard' })
      return
    }
    submitError.value = 'That problem was already answered, so here is the next one.'
    await nextTick()
    answerInput.value?.focus()
  } catch {
    submitError.value = 'Your answer could not be sent. Please try again.'
  }
}

async function handleNextProblem() {
  feedback.value = null
  submitError.value = null
  userAnswer.value = ''
  announcement.value = ''

  if (answered.value >= totalProblems.value) {
    router.push({ name: 'scorecard' })
  } else {
    await gameStore.loadNextProblem()

    // Focus the answer input for the next problem
    await nextTick()
    answerInput.value?.focus()
  }
}
</script>

<style scoped>
.game-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.loading {
  text-align: center;
  padding: 4rem;
  font-size: 1.2rem;
}

.game-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  flex-wrap: wrap;
}

.progress-info {
  flex: 1;
  min-width: 250px;
}

.progress-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.progress-info h3 {
  margin: 0;
  color: #333;
}

.btn-exit {
  background: none;
  border: 2px solid #ced4da;
  border-radius: 6px;
  padding: 0.35rem 0.75rem;
  min-height: 44px;
  font-size: 0.9rem;
  color: #495057;
  cursor: pointer;
}

.btn-exit:hover {
  border-color: #6c757d;
}

.progress-bar {
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s;
}

.game-stats {
  display: flex;
  gap: 2rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 0.875rem;
  color: #6c757d;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #667eea;
}

.streak {
  font-size: 1.25rem;
  font-weight: bold;
  color: #c2410c;
}

.stat-value.score-pop {
  animation: score-pop 0.7s ease;
}

@keyframes score-pop {
  30% {
    transform: scale(1.35);
    color: #28a745;
  }
}

.problem-card {
  min-height: 300px;
}

.problem-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.problem-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.problem-points {
  padding: 0.25rem 0.75rem;
  background: #ffe8a3;
  color: #5a3e00;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 600;
}

.problem-topic {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: #e7f3ff;
  color: #0066cc;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  align-self: flex-start;
}

.problem-question {
  font-family: var(--font-math);
  font-weight: 600;
  font-size: 1.75rem;
  letter-spacing: 0.5px;
  color: #333;
  line-height: 1.4;
}

.hints-section {
  background: #fff3cd;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #ffc107;
}

.hints-section h4 {
  margin-bottom: 0.5rem;
  color: #856404;
}

.hint-item {
  margin-bottom: 0.5rem;
  color: #856404;
}

.hint-penalty {
  /* 6.65:1 on the hint background (#fff3cd), WCAG AA */
  color: #a71d2a;
  font-size: 0.875rem;
  margin-left: 0.5rem;
}

.answer-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.answer-section .form-group {
  margin-bottom: 0;
}

.answer-section input {
  font-size: 1.1rem;
  padding: 1rem;
}

.format-tip {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #495057;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.feedback-card {
  text-align: center;
  padding: 2rem;
}

.feedback-card.success {
  background: #d4edda;
  border: 2px solid #28a745;
}

.feedback-card.error {
  background: #f8d7da;
  border: 2px solid #dc3545;
}

.feedback-card h3 {
  margin-bottom: 0.5rem;
}

.feedback-detail {
  font-size: 1.1rem;
  color: #333;
}

.answer-compare {
  display: inline-grid;
  grid-template-columns: auto auto;
  gap: 0.35rem 1rem;
  margin: 0.5rem auto 0;
  text-align: left;
  font-size: 1.1rem;
}

.answer-compare > div {
  display: contents;
}

.answer-compare dt {
  color: #495057;
}

.answer-compare dd {
  margin: 0;
  font-family: var(--font-math);
  font-weight: 600;
  color: #333;
}

.load-failure {
  text-align: center;
  padding: 2rem;
}

.load-failure p {
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.feedback-card button {
  margin-top: 1rem;
}

.feedback-card .hint-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #495057;
  font-style: italic;
}

/* Touch screens have no Enter key to press */
@media (hover: none) and (pointer: coarse) {
  .feedback-card .hint-text {
    display: none;
  }
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 0.5rem;
  vertical-align: middle;
}

.btn-secondary .spinner {
  border-color: rgba(0, 0, 0, 0.2);
  border-top-color: #333;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .game-view {
    padding: 1rem 0.75rem;
  }

  .game-container {
    gap: 1rem;
  }

  .game-header {
    flex-direction: column;
    gap: 1rem;
  }

  .progress-info {
    width: 100%;
    min-width: unset;
  }

  .progress-info h3 {
    font-size: 1rem;
  }

  .game-stats {
    width: 100%;
    justify-content: space-around;
    gap: 1rem;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .stat {
    flex-direction: row;
    gap: 0.5rem;
  }

  .stat-label {
    font-size: 0.8rem;
  }

  .stat-value {
    font-size: 1.25rem;
  }

  .problem-card {
    min-height: unset;
    padding: 1.25rem;
  }

  .problem-content {
    gap: 1rem;
  }

  .problem-topic {
    font-size: 0.8rem;
    padding: 0.2rem 0.6rem;
  }

  .problem-question {
    /* Early readers on phones: keep the question large */
    font-size: 1.5rem;
    line-height: 1.5;
  }

  .hints-section {
    padding: 0.75rem;
    font-size: 0.9rem;
  }

  .hints-section h4 {
    font-size: 0.9rem;
  }

  .answer-section input {
    font-size: 16px; /* Prevents iOS zoom */
    padding: 0.875rem;
  }

  .action-buttons {
    flex-direction: column-reverse;
    gap: 0.75rem;
  }

  .action-buttons .btn {
    width: 100%;
    padding: 0.875rem;
    font-size: 1rem;
  }

  .feedback-card {
    padding: 1.5rem 1rem;
  }

  .feedback-card h3 {
    font-size: 1.25rem;
  }

  .feedback-card button {
    width: 100%;
    padding: 0.875rem;
  }

  .loading {
    padding: 2rem;
    font-size: 1rem;
  }
}

@media (max-width: 380px) {
  .game-view {
    padding: 0.75rem 0.5rem;
  }

  .problem-card {
    padding: 1rem;
  }

  .problem-question {
    font-size: 1.5rem;
  }

  .game-stats {
    padding: 0.5rem;
  }

  .stat-value {
    font-size: 1.1rem;
  }
}
</style>
