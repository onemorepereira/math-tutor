<template>
  <div class="activity-calendar card">
    <h3>Platform Activity</h3>
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>
    <div v-else class="calendar-container">
      <div class="stats-summary">
        <div class="stat-item">
          <span class="stat-value">{{ totalGames }}</span>
          <span class="stat-label">Total Games</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ gamesThisWeek }}</span>
          <span class="stat-label">This Week</span>
        </div>
      </div>

      <div class="calendar-grid">
        <div
          v-for="day in calendarDays"
          :key="day.date"
          class="calendar-day"
          :class="getActivityClass(day.count)"
          :title="`${day.date}: ${day.count} game${day.count !== 1 ? 's' : ''}`"
        >
          <div class="day-label">{{ day.dayOfWeek }}</div>
          <div class="day-date">{{ day.dayOfMonth }}</div>
          <div v-if="day.count > 0" class="day-count">{{ day.count }}</div>
        </div>
      </div>

      <div class="legend">
        <span>Less</span>
        <div class="legend-box level-0"></div>
        <div class="legend-box level-1"></div>
        <div class="legend-box level-2"></div>
        <div class="legend-box level-3"></div>
        <div class="legend-box level-4"></div>
        <span>More</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { publicService, type ActivityStats } from '@/services/public'

const activityData = ref<ActivityStats | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const totalGames = computed(() => activityData.value?.totalGames || 0)

const calendarDays = computed(() => {
  const days = []
  const today = new Date()

  // Show last 14 days
  for (let i = 13; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    days.push({
      date: dateStr,
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayOfMonth: date.getDate(),
      count: activityData.value?.activityByDate[dateStr] || 0
    })
  }

  return days
})

const gamesThisWeek = computed(() => {
  if (!activityData.value) return 0

  const today = new Date()
  let count = 0

  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    count += activityData.value.activityByDate[dateStr] || 0
  }

  return count
})

function getActivityClass(count: number): string {
  if (count === 0) return 'level-0'
  if (count <= 2) return 'level-1'
  if (count <= 5) return 'level-2'
  if (count <= 10) return 'level-3'
  return 'level-4'
}

onMounted(async () => {
  try {
    activityData.value = await publicService.getActivityStats()
  } catch (err: any) {
    error.value = 'Failed to load activity data'
    console.error('Failed to load activity data:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.activity-calendar {
  max-width: 800px;
}

.activity-calendar h3 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.calendar-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats-summary {
  display: flex;
  gap: 2rem;
  justify-content: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #667eea;
}

.stat-label {
  font-size: 0.875rem;
  color: #6c757d;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(50px, 1fr));
  gap: 0.5rem;
  max-width: 100%;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 2px solid #e9ecef;
  background: #f8f9fa;
  transition: all 0.2s;
  cursor: pointer;
  position: relative;
  padding: 0.25rem;
}

.calendar-day:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.day-label {
  font-size: 0.7rem;
  color: #6c757d;
  font-weight: 600;
}

.day-date {
  font-size: 0.9rem;
  font-weight: bold;
  color: #333;
}

.day-count {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 0.7rem;
  font-weight: bold;
  color: white;
  background: #667eea;
  border-radius: 10px;
  padding: 0 4px;
  min-width: 16px;
  text-align: center;
}

.calendar-day.level-0 {
  background: #f8f9fa;
}

.calendar-day.level-1 {
  background: #d4edda;
  border-color: #c3e6cb;
}

.calendar-day.level-2 {
  background: #b8daff;
  border-color: #9fcdff;
}

.calendar-day.level-3 {
  background: #b8b8ff;
  border-color: #9999ff;
}

.calendar-day.level-4 {
  background: #667eea;
  border-color: #5568d3;
}

.calendar-day.level-4 .day-label,
.calendar-day.level-4 .day-date {
  color: white;
}

.legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6c757d;
}

.legend-box {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.legend-box.level-0 {
  background: #f8f9fa;
}

.legend-box.level-1 {
  background: #d4edda;
}

.legend-box.level-2 {
  background: #b8daff;
}

.legend-box.level-3 {
  background: #b8b8ff;
}

.legend-box.level-4 {
  background: #667eea;
}
</style>
