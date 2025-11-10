<template>
  <div class="stats-view">
    <div class="page-header">
      <router-link to="/" class="back-link">← Back to Home</router-link>
      <h2>Your Progress</h2>
    </div>

    <div v-if="loading" class="loading">Loading your statistics...</div>

    <div v-else-if="error" class="error-message">{{ error }}</div>

    <div v-else class="stats-container">
      <!-- Statistics Cards -->
      <div class="stats-grid">
        <div class="stat-card card" title="The total number of games you've played">
          <div class="stat-icon">🎮</div>
          <div class="stat-value">{{ stats.totalSessions }}</div>
          <div class="stat-label">Sessions Played</div>
          <div class="tooltip-text">How many games you've played</div>
        </div>

        <div class="stat-card card" title="All the math problems you've tried to solve">
          <div class="stat-icon">📝</div>
          <div class="stat-value">{{ stats.totalProblems }}</div>
          <div class="stat-label">Problems Solved</div>
          <div class="tooltip-text">All the math questions you've answered</div>
        </div>

        <div class="stat-card card" title="How often you get the answer right">
          <div class="stat-icon">🎯</div>
          <div class="stat-value">{{ stats.accuracy }}%</div>
          <div class="stat-label">Accuracy</div>
          <div class="tooltip-text">Your success rate - higher is better!</div>
        </div>

        <div class="stat-card card" title="Your typical score in each game">
          <div class="stat-icon">⭐</div>
          <div class="stat-value">{{ stats.averageScore }}</div>
          <div class="stat-label">Avg Score</div>
          <div class="tooltip-text">Your usual score per game</div>
        </div>

        <div class="stat-card card" title="Games where you got every question right!">
          <div class="stat-icon">✨</div>
          <div class="stat-value">{{ stats.perfectScores }}</div>
          <div class="stat-label">Perfect Scores</div>
          <div class="tooltip-text">Games where you got 100%! Amazing!</div>
        </div>

        <div class="stat-card card" title="The total questions you answered correctly">
          <div class="stat-icon">✅</div>
          <div class="stat-value">{{ stats.correctProblems }}</div>
          <div class="stat-label">Correct Answers</div>
          <div class="tooltip-text">All the questions you got right</div>
        </div>
      </div>

      <!-- Activity Heatmap -->
      <div v-if="stats.dailyActivity" class="activity-section">
        <h3>Your {{ currentYear }} Activity</h3>
        <p class="section-subtitle">Days you practiced math this year</p>
        <div class="heatmap-container">
          <div class="heatmap-months">
            <div v-for="month in months" :key="month" class="month-label">{{ month }}</div>
          </div>
          <div class="heatmap-grid">
            <div class="heatmap-weekdays">
              <div class="weekday-label">Mon</div>
              <div class="weekday-label">Wed</div>
              <div class="weekday-label">Fri</div>
            </div>
            <div class="heatmap-days">
              <div
                v-for="day in yearDays"
                :key="day.date"
                :class="['heatmap-day', getActivityLevel(day.activity)]"
                :title="getDayTooltip(day)"
              >
              </div>
            </div>
          </div>
          <div class="heatmap-legend">
            <span class="legend-label">Less</span>
            <div class="legend-box level-0"></div>
            <div class="legend-box level-1"></div>
            <div class="legend-box level-2"></div>
            <div class="legend-box level-3"></div>
            <div class="legend-box level-4"></div>
            <span class="legend-label">More</span>
          </div>
        </div>
      </div>

      <!-- Topic Performance -->
      <div v-if="stats.topicPerformance && stats.topicPerformance.length > 0" class="topic-time-section">
        <h3>Your Topic Performance</h3>
        <p class="section-subtitle">Practice topics where you need more help (shown first)</p>
        <div class="topic-time-grid">
          <div
            v-for="topicData in stats.topicPerformance"
            :key="topicData.topic"
            :class="['topic-time-card', 'card', getAccuracyClass(topicData.accuracy)]"
          >
            <div class="topic-header">
              <div class="topic-name">{{ topicData.topic }}</div>
              <div class="accuracy-badge" :class="getAccuracyClass(topicData.accuracy)">
                {{ topicData.accuracy }}%
              </div>
            </div>
            <div class="topic-stats">
              <div class="topic-stat">
                <span class="stat-icon">✅</span>
                <span>{{ topicData.correctCount }}/{{ topicData.problemCount }}</span>
              </div>
              <div class="topic-stat">
                <span class="stat-icon">⏱️</span>
                <span>{{ formatSeconds(topicData.totalSeconds) }}</span>
              </div>
            </div>
            <button
              @click="startTopicGame(topicData.topic)"
              class="btn btn-primary topic-practice-btn"
              :disabled="startingTopic === topicData.topic"
            >
              <span v-if="startingTopic === topicData.topic">
                <span class="spinner"></span>
                Starting game...
              </span>
              <span v-else>Practice This Topic</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Achievements -->
      <div v-if="stats.achievements && stats.achievements.length > 0" class="achievements-section">
        <h3>Achievements</h3>
        <div class="achievements-grid">
          <div
            v-for="achievement in stats.achievements"
            :key="achievement.id"
            :class="['achievement-card', 'card', { locked: !achievement.unlocked }]"
            :title="achievement.description"
          >
            <div class="achievement-badge">{{ achievement.unlocked ? '🏆' : '🔒' }}</div>
            <div class="achievement-name">{{ achievement.name }}</div>
            <div class="achievement-desc">{{ achievement.description }}</div>
            <div class="achievement-tooltip">
              {{ achievement.unlocked ? getAchievementTooltip(achievement.id) : getLockedTooltip(achievement.id) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Session History -->
      <div class="history-section">
        <h3>Recent Sessions</h3>
        <div v-if="sessions.length === 0" class="no-sessions">
          No sessions yet. Start your first game!
        </div>
        <div v-else class="sessions-table">
          <div v-for="session in displayedSessions" :key="session.sessionId" class="session-row card">
            <div class="session-info">
              <div class="session-header">
                <span class="difficulty-badge" :class="session.difficulty">
                  {{ session.difficulty }}
                </span>
                <span class="session-date">
                  {{ formatDate(session.startTime) }}
                </span>
              </div>
              <div class="session-stats">
                <span class="stat-item">
                  📝 {{ session.correctCount }}/{{ session.problemCount }} correct
                </span>
                <span class="stat-item">
                  ⭐ {{ session.totalScore }} points
                </span>
                <span class="stat-item">
                  ⏱️ {{ formatTime(session.totalTimeSeconds) }}
                </span>
              </div>
              <div v-if="session.subcategories && session.subcategories.length > 0" class="session-topics">
                Topics: {{ session.subcategories.join(', ') }}
              </div>
            </div>
          </div>
          <div v-if="sessions.length > sessionsToShow" class="load-more-container">
            <button @click="loadMoreSessions" class="btn btn-secondary load-more-btn">
              Load More ({{ sessions.length - sessionsToShow }} remaining)
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '@/services/auth'
import { useGameStore } from '@/stores/game'

const router = useRouter()
const gameStore = useGameStore()

const loading = ref(true)
const error = ref<string | null>(null)
const stats = ref<any>({})
const sessions = ref<any[]>([])
const sessionsToShow = ref(5)
const startingTopic = ref<string | null>(null)

const currentYear = new Date().getFullYear()
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const displayedSessions = computed(() => {
  return sessions.value.slice(0, sessionsToShow.value)
})

const yearDays = computed(() => {
  const days: Array<{ date: string, activity: any }> = []
  const startDate = new Date(currentYear, 0, 1) // January 1st of current year

  // Start from the Monday of the week containing Jan 1
  const dayOfWeek = startDate.getDay()
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Adjust to previous Monday
  const firstMonday = new Date(startDate)
  firstMonday.setDate(startDate.getDate() + offset)

  // Generate 53 weeks worth of days (371 days to cover full year)
  for (let i = 0; i < 371; i++) {
    const date = new Date(firstMonday)
    date.setDate(firstMonday.getDate() + i)

    const dateKey = date.toISOString().split('T')[0]
    const activity = stats.value.dailyActivity?.[dateKey] || null

    days.push({ date: dateKey, activity })
  }

  return days
})

function loadMoreSessions() {
  sessionsToShow.value = sessions.value.length
}

onMounted(async () => {
  try {
    const data = await authService.getUserStats()
    stats.value = data.statistics
    sessions.value = data.sessions
  } catch (err: any) {
    error.value = err.message || 'Failed to load statistics'
  } finally {
    loading.value = false
  }
})

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

function formatSeconds(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

function getAchievementTooltip(id: string): string {
  const tooltips: Record<string, string> = {
    'first_game': 'You started your math journey!',
    'dedicated': 'You love learning math!',
    'math_master': 'You\'re becoming a math expert!',
    'perfect': 'You aced a whole game!',
    'perfectionist': 'You\'re a perfect score champion!',
    'century': 'That\'s a LOT of practice!',
    'expert': 'Wow! You\'re a math superstar!',
    'accurate': 'You make very few mistakes!'
  }
  return tooltips[id] || 'Great job!'
}

function getLockedTooltip(id: string): string {
  const tooltips: Record<string, string> = {
    'first_game': 'Play your first game to unlock!',
    'dedicated': 'Play 10 games to unlock!',
    'math_master': 'Play 50 games to unlock!',
    'perfect': 'Get all answers right in one game!',
    'perfectionist': 'Get 10 perfect scores to unlock!',
    'century': 'Solve 100 problems to unlock!',
    'expert': 'Solve 500 problems to unlock!',
    'accurate': 'Get 90% or more correct (min 10 problems)!'
  }
  return tooltips[id] || 'Keep playing to unlock!'
}

function getAccuracyClass(accuracy: number): string {
  if (accuracy >= 80) return 'high-accuracy'
  if (accuracy >= 60) return 'medium-accuracy'
  return 'low-accuracy'
}

async function startTopicGame(topic: string) {
  try {
    startingTopic.value = topic
    gameStore.resetGame()
    await gameStore.startNewGame('elementary', 10, [topic])
    router.push({ name: 'game' })
  } catch (err) {
    console.error('Failed to start topic game:', err)
  } finally {
    startingTopic.value = null
  }
}

function getActivityLevel(activity: any): string {
  if (!activity) return 'level-0'

  const sessionCount = activity.sessionCount || 0

  if (sessionCount >= 5) return 'level-4'
  if (sessionCount >= 3) return 'level-3'
  if (sessionCount >= 2) return 'level-2'
  if (sessionCount >= 1) return 'level-1'
  return 'level-0'
}

function getDayTooltip(day: { date: string, activity: any }): string {
  const date = new Date(day.date)
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (!day.activity) {
    return `${formattedDate}: No activity`
  }

  const sessions = day.activity.sessionCount || 0
  const time = formatTime(day.activity.totalTime || 0)

  return `${formattedDate}: ${sessions} session${sessions !== 1 ? 's' : ''}, ${time}`
}
</script>

<style scoped>
.stats-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  position: relative;
  margin-bottom: 2rem;
}

.back-link {
  display: inline-block;
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  margin-bottom: 1rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: #5568d3;
}

.stats-view h2 {
  text-align: center;
  margin: 0;
  color: #333;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #6c757d;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.stat-card {
  text-align: center;
  padding: 1.5rem;
  position: relative;
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.tooltip-text {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  margin-bottom: 0.5rem;
  z-index: 10;
}

.tooltip-text::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #333;
}

.stat-card:hover .tooltip-text {
  opacity: 1;
}

.stat-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 0.25rem;
}

.stat-label {
  color: #6c757d;
  font-size: 0.9rem;
}

.activity-section {
  margin-bottom: 3rem;
}

.activity-section h3 {
  margin-bottom: 0.5rem;
  color: #333;
}

.heatmap-container {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
}

.heatmap-months {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 4px;
  margin-bottom: 0.5rem;
  padding-left: 30px;
}

.month-label {
  font-size: 0.75rem;
  color: #6c757d;
  text-align: left;
}

.heatmap-grid {
  display: flex;
  gap: 4px;
}

.heatmap-weekdays {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  gap: 4px;
  padding-right: 4px;
}

.weekday-label {
  font-size: 0.7rem;
  color: #6c757d;
  line-height: 12px;
  text-align: right;
}

.heatmap-days {
  display: grid;
  grid-template-rows: repeat(7, 12px);
  grid-auto-flow: column;
  gap: 4px;
  flex: 1;
}

.heatmap-day {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.2s;
}

.heatmap-day:hover {
  transform: scale(1.3);
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.heatmap-day.level-0 {
  background: #ebedf0;
}

.heatmap-day.level-1 {
  background: #9be9a8;
}

.heatmap-day.level-2 {
  background: #40c463;
}

.heatmap-day.level-3 {
  background: #30a14e;
}

.heatmap-day.level-4 {
  background: #216e39;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  justify-content: flex-end;
  font-size: 0.75rem;
  color: #6c757d;
}

.legend-box {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-label {
  font-size: 0.75rem;
}

.topic-time-section {
  margin-bottom: 3rem;
}

.topic-time-section h3 {
  margin-bottom: 0.5rem;
  color: #333;
}

.section-subtitle {
  color: #6c757d;
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
  margin-top: 0;
}

.topic-time-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
}

.topic-time-card {
  padding: 1.5rem;
  color: white;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.topic-time-card.low-accuracy {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 50%, #ff8787 100%);
  box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
}

.topic-time-card.medium-accuracy {
  background: linear-gradient(135deg, #ffa502 0%, #ff7f50 50%, #ff6348 100%);
  box-shadow: 0 4px 15px rgba(255, 165, 2, 0.3);
}

.topic-time-card.high-accuracy {
  background: linear-gradient(135deg, #4cd137 0%, #32c759 50%, #2ecc71 100%);
  box-shadow: 0 4px 15px rgba(76, 209, 55, 0.3);
}

.topic-time-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.topic-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.topic-name {
  font-size: 1.1rem;
  font-weight: 700;
  flex: 1;
  text-align: left;
}

.accuracy-badge {
  font-size: 1.25rem;
  font-weight: 800;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.topic-stats {
  display: flex;
  justify-content: space-around;
  gap: 1rem;
  padding: 0.75rem 0;
}

.topic-stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.stat-icon {
  font-size: 1.25rem;
}

.topic-practice-btn {
  width: 100%;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  border: none;
  font-weight: 700;
  padding: 0.75rem;
  transition: all 0.2s;
}

.topic-practice-btn:hover {
  background: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.achievements-section {
  margin-bottom: 3rem;
}

.achievements-section h3 {
  margin-bottom: 1.5rem;
  color: #333;
}

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.achievement-card {
  padding: 1.5rem;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  position: relative;
  transition: all 0.3s;
}

.achievement-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.achievement-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  margin-bottom: 0.5rem;
  z-index: 10;
}

.achievement-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

.achievement-card:hover .achievement-tooltip {
  opacity: 1;
}

.achievement-card.locked {
  background: linear-gradient(135deg, #9e9e9e 0%, #757575 100%);
  opacity: 0.6;
  filter: grayscale(0.5);
}

.achievement-card.locked:hover {
  opacity: 0.8;
  transform: translateY(-2px);
}

.achievement-badge {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.achievement-name {
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.achievement-desc {
  font-size: 0.85rem;
  opacity: 0.9;
}

.history-section h3 {
  margin-bottom: 1.5rem;
  color: #333;
}

.no-sessions {
  text-align: center;
  padding: 3rem;
  color: #6c757d;
}

.sessions-table {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.session-row {
  padding: 1.5rem;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.difficulty-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: capitalize;
}

.difficulty-badge.elementary {
  background: #d1f4e0;
  color: #0f6938;
}

.difficulty-badge.middle {
  background: #fff4d1;
  color: #8b6914;
}

.difficulty-badge.high {
  background: #ffd1d1;
  color: #8b1414;
}

.session-date {
  color: #6c757d;
  font-size: 0.9rem;
}

.session-stats {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.stat-item {
  font-size: 0.95rem;
  color: #495057;
}

.session-topics {
  font-size: 0.9rem;
  color: #6c757d;
  margin-top: 0.5rem;
}

.load-more-container {
  text-align: center;
  margin-top: 1.5rem;
}

.load-more-btn {
  min-width: 200px;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  border-top-color: #333;
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

.topic-practice-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
