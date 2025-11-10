<template>
  <div class="game-view">
    <div v-if="isLoading && !currentProblem" class="loading">
      Loading your math problems
    </div>

    <div v-else-if="currentProblem" class="game-container">
      <div class="game-header">
        <div class="progress-info">
          <h3>Problem {{ currentProblemNumber }} of {{ totalProblems }}</h3>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${(currentProblemNumber / totalProblems) * 100}%` }"
            ></div>
          </div>
        </div>

        <div class="game-stats">
          <div class="stat">
            <span class="stat-label">Score:</span>
            <span class="stat-value">{{ currentSession?.totalScore || 0 }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Time:</span>
            <span class="stat-value">{{ formatTime(elapsedTime) }}</span>
          </div>
        </div>
      </div>

      <div class="problem-card card">
        <div class="problem-content">
          <div class="problem-topic">{{ currentProblem.topic }}</div>
          <h2 class="problem-question">{{ currentProblem.question }}</h2>

          <div v-if="hintsReceived.length > 0" class="hints-section">
            <h4>Hints:</h4>
            <div v-for="hint in hintsReceived" :key="hint.hintNumber" class="hint-item">
              <strong>Hint {{ hint.hintNumber }}:</strong> {{ hint.content }}
              <span class="hint-penalty">(-{{ hint.pointDeduction }} points)</span>
            </div>
          </div>

          <div class="answer-section">
            <div class="form-group">
              <label for="answer">Your Answer:</label>
              <input
                id="answer"
                ref="answerInput"
                v-model="userAnswer"
                type="text"
                placeholder="Enter your answer"
                @keyup.enter="handleSubmit"
                :disabled="isSubmitting"
                autocomplete="off"
              />
            </div>

            <div class="action-buttons">
              <button
                @click="handleHintRequest"
                class="btn btn-secondary"
                :disabled="!canRequestHint || isLoading"
              >
                <span v-if="isLoading && !isSubmitting">
                  <span class="spinner"></span>
                  Getting hint...
                </span>
                <span v-else>
                  Request Hint ({{ 2 - hintsUsedCount }} left)
                </span>
              </button>

              <button
                @click="handleSubmit"
                class="btn btn-primary"
                :disabled="!userAnswer.trim() || isSubmitting"
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

      <div v-if="feedback" ref="feedbackCard" class="feedback-card card" :class="feedback.type" @keyup.enter="handleNextProblem" tabindex="0">
        <h3>{{ feedback.message }}</h3>
        <p v-if="feedback.details">{{ feedback.details }}</p>
        <button @click="handleNextProblem" class="btn btn-primary">
          {{ currentProblemNumber >= totalProblems ? 'View Scorecard' : 'Next Problem' }}
        </button>
        <p v-if="feedback.type === 'success'" class="hint-text">Press Enter to continue</p>
      </div>
    </div>

    <div v-else class="error-message">
      Failed to load game. Please try again.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'

const router = useRouter()
const gameStore = useGameStore()

const userAnswer = ref('')
const isSubmitting = ref(false)
const feedback = ref<{ type: string; message: string; details?: string } | null>(null)
const feedbackCard = ref<HTMLDivElement | null>(null)
const answerInput = ref<HTMLInputElement | null>(null)
const elapsedTime = ref(0)
let timerInterval: number | null = null

const currentProblem = computed(() => gameStore.currentProblem)
const currentSession = computed(() => gameStore.currentSession)
const currentProblemNumber = computed(() => gameStore.currentProblemNumber)
const totalProblems = computed(() => gameStore.totalProblems)
const isLoading = computed(() => gameStore.isLoading)
const canRequestHint = computed(() => gameStore.canRequestHint)
const hintsUsedCount = computed(() => gameStore.hintsUsedCount)
const hintsReceived = computed(() => gameStore.hintsReceived)

onMounted(async () => {
  if (!currentSession.value) {
    router.push({ name: 'home' })
    return
  }

  startTimer()

  // Focus the answer input on initial load
  await nextTick()
  answerInput.value?.focus()
})

onUnmounted(() => {
  stopTimer()
})

function startTimer() {
  elapsedTime.value = 0
  timerInterval = window.setInterval(() => {
    elapsedTime.value++
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

async function handleHintRequest() {
  try {
    const hint = await gameStore.requestHint()
    if (hint) {
      feedback.value = null
    }
  } catch (error) {
    console.error('Failed to get hint:', error)
  }
}

async function handleSubmit() {
  if (!userAnswer.value.trim()) return

  isSubmitting.value = true
  feedback.value = null

  try {
    const result = await gameStore.submitAnswer(userAnswer.value)

    if (result.isCorrect) {
      feedback.value = {
        type: 'success',
        message: 'Correct!',
        details: `You earned ${result.pointsEarned} points!`
      }

      stopTimer()

      // Focus the feedback card so Enter key works to advance
      await nextTick()
      feedbackCard.value?.focus()
    } else {
      feedback.value = {
        type: 'error',
        message: 'Not quite right',
        details: 'Try again or click Next Problem to continue'
      }

      // Clear the input and refocus it so they can try again
      userAnswer.value = ''
      await nextTick()
      answerInput.value?.focus()
    }
  } catch (error) {
    console.error('Failed to submit answer:', error)
    feedback.value = {
      type: 'error',
      message: 'Failed to submit answer',
      details: 'Please try again'
    }
  } finally {
    isSubmitting.value = false
  }
}

async function handleNextProblem() {
  feedback.value = null
  userAnswer.value = ''

  if (currentProblemNumber.value >= totalProblems.value) {
    router.push({ name: 'scorecard' })
  } else {
    await gameStore.loadNextProblem()
    startTimer()

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

.progress-info h3 {
  margin-bottom: 0.5rem;
  color: #333;
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

.problem-card {
  min-height: 300px;
}

.problem-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
  font-size: 1.75rem;
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
  color: #dc3545;
  font-size: 0.875rem;
  margin-left: 0.5rem;
}

.answer-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.answer-section input {
  font-size: 1.1rem;
  padding: 1rem;
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

.feedback-card button {
  margin-top: 1rem;
}

.feedback-card .hint-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #6c757d;
  font-style: italic;
}

.feedback-card:focus {
  outline: none;
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
</style>
