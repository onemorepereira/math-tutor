<template>
  <div class="scorecard-view">
    <div v-if="isLoading" class="loading">Loading your scorecard</div>

    <div v-else-if="scorecard" class="scorecard-container">
      <div class="scorecard-header card">
        <h1>Game Complete!</h1>
        <div class="final-score">
          <div class="score-circle">
            <span class="score-value">{{ scorecard.totalScore }}</span>
            <span class="score-max">/ {{ scorecard.maxPossibleScore }}</span>
          </div>
          <p class="score-label">Total Score</p>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ scorecard.correctAnswers }}</div>
            <div class="stat-label">Correct</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ scorecard.incorrectAnswers }}</div>
            <div class="stat-label">Incorrect</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ scorecard.hintsUsed }}</div>
            <div class="stat-label">Hints Used</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ formatTime(scorecard.totalTimeSeconds) }}</div>
            <div class="stat-label">Total Time</div>
          </div>
        </div>

        <div class="score-message">
          <p>{{ getScoreMessage() }}</p>
        </div>
      </div>

      <div v-if="scorecard.incorrectAnswers > 0" class="review-section">
        <h2>Review Wrong Answers</h2>
        <p class="review-intro">
          Let's learn from these problems! Click on any problem to see a detailed explanation.
        </p>

        <div class="problems-list">
          <div
            v-for="attempt in incorrectAttempts"
            :key="attempt.problemId"
            class="problem-item card"
            @click="toggleExplanation(attempt.problemId)"
          >
            <div class="problem-header">
              <h3>{{ attempt.problem.question }}</h3>
              <span class="expand-icon">{{ expandedProblem === attempt.problemId ? '−' : '+' }}</span>
            </div>

            <div class="problem-details">
              <div class="detail-row">
                <span class="label">Your Answer:</span>
                <span class="value incorrect">{{ attempt.userAnswer }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Correct Answer:</span>
                <span class="value correct">{{ attempt.problem.correctAnswer }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Time Spent:</span>
                <span class="value">{{ attempt.timeSpentSeconds }}s</span>
              </div>
            </div>

            <div v-if="expandedProblem === attempt.problemId" class="explanation-section">
              <div v-if="loadingExplanation" class="loading-explanation">
                Loading explanation...
              </div>
              <div v-else-if="currentExplanation" class="explanation-content">
                <h4>How to Solve This:</h4>
                <p class="explanation-text">{{ currentExplanation.explanation }}</p>

                <div v-if="currentExplanation.steps.length > 0" class="steps-section">
                  <h5>Step by Step:</h5>
                  <ol class="steps-list">
                    <li v-for="(step, index) in currentExplanation.steps" :key="index">
                      {{ step }}
                    </li>
                  </ol>
                </div>

                <div class="insight-section">
                  <h5>Insight:</h5>
                  <p class="insight-text">{{ currentExplanation.ageAppropriateInsight }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="actions-section">
        <button @click="playAgain" class="btn btn-primary">Play Again</button>
        <button @click="goHome" class="btn btn-secondary">Back to Home</button>
      </div>
    </div>

    <div v-else class="error-message">
      No scorecard available. Please complete a game first.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import type { SolutionExplanation } from '@/types'

const router = useRouter()
const gameStore = useGameStore()

const expandedProblem = ref<string | null>(null)
const currentExplanation = ref<SolutionExplanation | null>(null)
const loadingExplanation = ref(false)

const scorecard = computed(() => gameStore.scorecard)
const isLoading = computed(() => gameStore.isLoading)

const incorrectAttempts = computed(() => {
  return scorecard.value?.attempts.filter(attempt => !attempt.isCorrect) || []
})

onMounted(async () => {
  if (!scorecard.value) {
    if (gameStore.currentSession && !gameStore.currentSession.isCompleted) {
      await gameStore.endGame()
    } else {
      router.push({ name: 'home' })
    }
  }
})

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getScoreMessage(): string {
  if (!scorecard.value) return ''

  const percentage = (scorecard.value.totalScore / scorecard.value.maxPossibleScore) * 100

  if (percentage >= 90) {
    return 'Outstanding! You\'re a math superstar!'
  } else if (percentage >= 70) {
    return 'Great job! You\'re doing really well!'
  } else if (percentage >= 50) {
    return 'Good effort! Keep practicing and you\'ll improve!'
  } else {
    return 'Keep learning! Every problem is a chance to grow!'
  }
}

async function toggleExplanation(problemId: string) {
  if (expandedProblem.value === problemId) {
    expandedProblem.value = null
    currentExplanation.value = null
    return
  }

  expandedProblem.value = problemId
  loadingExplanation.value = true

  try {
    const explanation = await gameStore.getSolutionExplanation(problemId)
    currentExplanation.value = explanation
  } catch (error) {
    console.error('Failed to load explanation:', error)
  } finally {
    loadingExplanation.value = false
  }
}

function playAgain() {
  gameStore.resetGame()
  router.push({ name: 'home' })
}

function goHome() {
  gameStore.resetGame()
  router.push({ name: 'home' })
}
</script>

<style scoped>
.scorecard-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.loading {
  text-align: center;
  padding: 4rem;
  font-size: 1.2rem;
}

.scorecard-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.scorecard-header {
  text-align: center;
  padding: 3rem 2rem;
}

.scorecard-header h1 {
  margin-bottom: 2rem;
  color: #333;
  font-size: 2.5rem;
}

.final-score {
  margin-bottom: 2rem;
}

.score-circle {
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  margin-bottom: 1rem;
  flex-direction: column;
  padding: 2rem;
}

.score-value {
  font-size: 4rem;
  font-weight: bold;
  line-height: 1;
}

.score-max {
  font-size: 1.5rem;
  opacity: 0.9;
}

.score-label {
  font-size: 1.2rem;
  color: #6c757d;
  font-weight: 500;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.stat-item {
  text-align: center;
}

.stat-item .stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #667eea;
  display: block;
}

.stat-item .stat-label {
  color: #6c757d;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  display: block;
}

.score-message {
  margin-top: 2rem;
  padding: 1rem;
  background: #e7f3ff;
  border-radius: 8px;
}

.score-message p {
  font-size: 1.2rem;
  color: #0066cc;
  font-weight: 500;
  margin: 0;
}

.review-section {
  margin-top: 2rem;
}

.review-section h2 {
  color: #333;
  margin-bottom: 0.5rem;
}

.review-intro {
  color: #6c757d;
  margin-bottom: 1.5rem;
}

.problems-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.problem-item {
  cursor: pointer;
  transition: all 0.3s;
}

.problem-item:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.problem-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.problem-header h3 {
  flex: 1;
  color: #333;
  font-size: 1.1rem;
}

.expand-icon {
  font-size: 1.5rem;
  color: #667eea;
  font-weight: bold;
  margin-left: 1rem;
}

.problem-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  gap: 1rem;
}

.detail-row .label {
  font-weight: 500;
  color: #6c757d;
  min-width: 120px;
}

.detail-row .value {
  color: #333;
}

.detail-row .value.incorrect {
  color: #dc3545;
  text-decoration: line-through;
}

.detail-row .value.correct {
  color: #28a745;
  font-weight: 600;
}

.explanation-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 2px solid #e9ecef;
}

.loading-explanation {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.explanation-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.explanation-content h4,
.explanation-content h5 {
  color: #667eea;
  margin-bottom: 0.5rem;
}

.explanation-text {
  color: #333;
  line-height: 1.6;
}

.steps-section {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
}

.steps-list {
  margin: 0.5rem 0 0 1.5rem;
  color: #333;
}

.steps-list li {
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.insight-section {
  background: #e7f3ff;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #0066cc;
}

.insight-text {
  color: #0066cc;
  line-height: 1.6;
  margin: 0;
}

.actions-section {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}
</style>
