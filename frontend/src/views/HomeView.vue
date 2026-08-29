<template>
  <div class="home-view">
    <div v-if="!isAuthenticated" class="hero">
      <h1 class="hero-title">Welcome to Number Ninja!</h1>
      <p class="hero-subtitle">Master math like a ninja with AI-powered training</p>
      <div class="hero-actions">
        <router-link to="/register" class="btn btn-primary">Get Started</router-link>
        <router-link to="/login" class="btn btn-secondary">Login</router-link>
      </div>

      <div class="public-stats">
        <ActivityCalendar />
        <Leaderboard />
      </div>
    </div>

    <div v-else class="dashboard">
      <div class="welcome-card card">
        <h2>Welcome back, {{ user?.screenName }}!</h2>
        <p>Ready to solve some math problems?</p>
        <p v-if="belt" class="belt-chip" :title="beltProgress">
          {{ belt.emoji }} {{ belt.name }} Belt<span v-if="beltProgress" class="belt-progress"> · {{ beltProgress }}</span>
        </p>
        <router-link to="/stats" class="stats-link">📊 View Your Progress</router-link>
      </div>

      <div v-if="resumable" class="resume-card card">
        <div class="resume-text">
          <h3>⏸️ You have an unfinished game</h3>
          <p>{{ resumableLabel }}</p>
        </div>
        <div class="resume-actions">
          <button @click="continueGame" class="btn btn-primary" :disabled="isLoadingGame">Continue</button>
          <button @click="resumable = null" class="btn btn-secondary" :disabled="isLoadingGame">Not now</button>
        </div>
      </div>

      <!-- Step 1: Select Difficulty -->
      <div v-if="!selectedDifficulty" class="difficulty-selection">
        <h3>Select Difficulty Level</h3>
        <div class="difficulty-cards">
          <div
            class="difficulty-card"
            role="button"
            tabindex="0"
            @click="selectDifficulty('elementary')"
            @keydown.enter.prevent="selectDifficulty('elementary')"
            @keydown.space.prevent="selectDifficulty('elementary')"
          >
            <h4>Elementary</h4>
            <p>Ages 6-10</p>
            <p>Basic arithmetic, addition, subtraction</p>
            <span class="btn btn-primary">Select</span>
          </div>

          <div
            class="difficulty-card"
            role="button"
            tabindex="0"
            @click="selectDifficulty('middle')"
            @keydown.enter.prevent="selectDifficulty('middle')"
            @keydown.space.prevent="selectDifficulty('middle')"
          >
            <h4>Middle School</h4>
            <p>Ages 11-14</p>
            <p>Fractions, decimals, pre-algebra</p>
            <span class="btn btn-primary">Select</span>
          </div>

          <div class="difficulty-card disabled" title="Coming soon!" aria-disabled="true">
            <h4>High School</h4>
            <p>Ages 15-18</p>
            <p>Algebra, geometry, advanced topics</p>
            <span class="btn btn-secondary">Coming Soon</span>
          </div>
        </div>
      </div>

      <!-- Step 2: Select Subcategories and Problem Count -->
      <div v-else class="subcategory-selection card">
        <h3>Customize Your Session</h3>

        <!-- Problem Count Selection -->
        <div class="option-section">
          <h4>Number of Problems</h4>
          <div class="problem-count-buttons">
            <button
              v-for="count in [5, 10, 15, 20]"
              :key="count"
              @click="problemCount = count"
              :class="['count-btn', { active: problemCount === count }]"
            >
              {{ count }}
            </button>
          </div>
        </div>

        <!-- Topic Selection -->
        <div class="option-section">
          <h4>Topics (Optional)</h4>
          <p class="subtitle">Select specific topics, or leave unchecked to practice all</p>
          <div class="subcategory-list">
            <label
              v-for="subcategory in availableSubcategories"
              :key="subcategory"
              class="subcategory-checkbox"
            >
              <input
                type="checkbox"
                :value="subcategory"
                v-model="selectedSubcategories"
              />
              <span>{{ subcategory }}</span>
            </label>
          </div>
        </div>

        <div class="action-buttons">
          <button @click="selectedDifficulty = null" class="btn btn-secondary" :disabled="isLoadingGame">
            Back
          </button>
          <button @click="startGame" class="btn btn-primary" :disabled="isLoadingGame">
            <span v-if="isLoadingGame">
              <span class="spinner"></span>
              Generating problems...
            </span>
            <span v-else>Start Game</span>
          </button>
        </div>
      </div>
    </div>

    <GameLoadingOverlay v-if="isLoadingGame" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGameStore } from '@/stores/game'
import { authService } from '@/services/auth'
import type { DifficultyLevel } from '@/types'
import { SUBCATEGORIES } from '@/types'
import { beltRank } from '@/utils/belt'
import Leaderboard from '@/components/Leaderboard.vue'
import ActivityCalendar from '@/components/ActivityCalendar.vue'
import GameLoadingOverlay from '@/components/GameLoadingOverlay.vue'

interface ResumableSession {
  sessionId: string
  difficulty: string
  startTime: string
  problemCount: number
  correctCount: number
  isCompleted: boolean
}

const router = useRouter()
const authStore = useAuthStore()
const gameStore = useGameStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)
const user = computed(() => authStore.user)

const selectedDifficulty = ref<DifficultyLevel | null>(null)
const selectedSubcategories = ref<string[]>([])
const problemCount = ref<number>(10)
const resumable = ref<ResumableSession | null>(null)

const belt = computed(() => {
  const score = user.value?.totalScore
  return typeof score === 'number' ? beltRank(score) : null
})

const beltProgress = computed(() => {
  if (!belt.value?.nextAt || user.value?.totalScore === undefined) return ''
  return `${belt.value.nextAt - user.value.totalScore} points to the next belt`
})

const resumableLabel = computed(() => {
  if (!resumable.value) return ''
  const difficultyName = resumable.value.difficulty === 'middle' ? 'Middle School' : resumable.value.difficulty === 'high' ? 'High School' : 'Elementary'
  return `${difficultyName} · started ${new Date(resumable.value.startTime).toLocaleString()}`
})

onMounted(async () => {
  if (!isAuthenticated.value || gameStore.currentSession) return

  try {
    const stats = await authService.getUserStats()
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    resumable.value = (stats.sessions as ResumableSession[] | undefined)?.find(
      (s) => !s.isCompleted && new Date(s.startTime).getTime() > dayAgo
    ) ?? null
  } catch {
    // The resume banner is a convenience; never block the dashboard on it
    resumable.value = null
  }
})

async function continueGame() {
  if (!resumable.value) return

  try {
    await gameStore.resumeSession(resumable.value.sessionId)
    router.push({ name: gameStore.scorecard ? 'scorecard' : 'game' })
  } catch (error) {
    console.error('Failed to resume game:', error)
    resumable.value = null
  }
}

const availableSubcategories = computed(() => {
  if (!selectedDifficulty.value) return []
  return SUBCATEGORIES[selectedDifficulty.value]
})

const isLoadingGame = computed(() => gameStore.isLoading)

function selectDifficulty(difficulty: DifficultyLevel) {
  selectedDifficulty.value = difficulty
  selectedSubcategories.value = []
  problemCount.value = 10
}

async function startGame() {
  if (!selectedDifficulty.value) return

  try {
    await gameStore.startNewGame(
      selectedDifficulty.value,
      problemCount.value,
      selectedSubcategories.value.length > 0 ? selectedSubcategories.value : undefined
    )
    router.push({ name: 'game' })
  } catch (error) {
    console.error('Failed to start game:', error)
  }
}
</script>

<style scoped>
.home-view {
  padding: 2rem 0;
}

.hero {
  text-align: center;
  padding: 4rem 2rem;
}

.hero-title {
  font-size: 3rem;
  font-weight: bold;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: 1.5rem;
  color: #6c757d;
  margin-bottom: 2rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 3rem;
}

.public-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

@media (max-width: 768px) {
  .public-stats {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 0 1rem;
  }

  .hero {
    padding: 2rem 1rem;
  }

  .hero-title {
    font-size: 2rem;
  }

  .hero-subtitle {
    font-size: 1.2rem;
  }

  .hero-actions {
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .hero-actions .btn {
    width: 100%;
    max-width: 300px;
  }
}

.dashboard {
  max-width: 1000px;
  margin: 0 auto;
}

.welcome-card {
  margin-bottom: 2rem;
  text-align: center;
}

.welcome-card h2 {
  margin-bottom: 0.5rem;
  color: #333;
}

.stats-link {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  background: #667eea;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.2s;
}

.stats-link:hover {
  background: #5568d3;
  transform: translateY(-2px);
}

.belt-chip {
  display: block;
  width: fit-content;
  margin: 0.75rem auto 1rem;
  padding: 0.35rem 0.85rem;
  background: #f4f1fb;
  border: 1px solid #d9d2ef;
  border-radius: 999px;
  font-weight: 600;
  color: #4a3f6b;
}

.belt-progress {
  font-weight: 400;
  color: #6c757d;
  font-size: 0.9rem;
}

.resume-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  border-left: 4px solid #667eea;
  margin-bottom: 1.5rem;
}

.resume-text h3 {
  margin-bottom: 0.25rem;
  color: #333;
}

.resume-text p {
  color: #6c757d;
  font-size: 0.9rem;
}

.resume-actions {
  display: flex;
  gap: 0.75rem;
}

.difficulty-card:focus-visible {
  outline: 3px solid #667eea;
  outline-offset: 2px;
}

.difficulty-selection {
  margin-top: 2rem;
}

.difficulty-selection h3 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.difficulty-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.difficulty-card {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
}

.difficulty-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.difficulty-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f5f5f5;
  filter: grayscale(0.8);
}

.difficulty-card.disabled:hover {
  transform: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.difficulty-card.disabled h4 {
  color: #999;
}

.difficulty-card h4 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #667eea;
}

.difficulty-card p {
  color: #6c757d;
  margin-bottom: 0.5rem;
}

.difficulty-card button {
  margin-top: 1rem;
}

.subcategory-selection {
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
}

.subcategory-selection h3 {
  text-align: center;
  margin-bottom: 0.5rem;
  color: #333;
}

.subcategory-selection .subtitle {
  text-align: center;
  color: #6c757d;
  font-size: 0.9rem;
  margin-bottom: 2rem;
}

.subcategory-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.subcategory-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.subcategory-checkbox:hover {
  background: #e9ecef;
}

.subcategory-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.subcategory-checkbox span {
  font-weight: 500;
  color: #495057;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.action-buttons button {
  min-width: 120px;
}

.option-section {
  margin-bottom: 2rem;
}

.option-section h4 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  color: #333;
}

.problem-count-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.count-btn {
  padding: 1rem 2rem;
  font-size: 1.2rem;
  font-weight: 600;
  background: #f8f9fa;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.count-btn:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.count-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 0.5rem;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
