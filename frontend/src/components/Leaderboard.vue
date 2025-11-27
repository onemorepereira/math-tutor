<template>
  <div class="leaderboard card">
    <h3>Top 10 Ninjas</h3>
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>
    <div v-else-if="leaderboard.length === 0" class="empty-state">
      No games played yet. Be the first!
    </div>
    <div v-else class="leaderboard-list">
      <div
        v-for="entry in leaderboard"
        :key="entry.rank"
        class="leaderboard-entry"
        :class="{ 'top-three': entry.rank <= 3 }"
      >
        <div class="rank">
          <span v-if="entry.rank === 1" class="medal">🥇</span>
          <span v-else-if="entry.rank === 2" class="medal">🥈</span>
          <span v-else-if="entry.rank === 3" class="medal">🥉</span>
          <span v-else>{{ entry.rank }}</span>
        </div>
        <div class="player-info">
          <div class="screen-name">{{ entry.screenName }}</div>
          <div class="stats">
            {{ entry.gamesPlayed }} game{{ entry.gamesPlayed !== 1 ? 's' : '' }} played
          </div>
        </div>
        <div class="score">{{ entry.totalScore.toLocaleString() }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { publicService, type LeaderboardEntry } from '@/services/public'

const leaderboard = ref<LeaderboardEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    leaderboard.value = await publicService.getLeaderboard()
  } catch (err: any) {
    error.value = 'Failed to load leaderboard'
    console.error('Failed to load leaderboard:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.leaderboard {
  max-width: 600px;
}

.leaderboard h3 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.loading,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.leaderboard-entry {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  transition: all 0.2s;
}

.leaderboard-entry:hover {
  background: #e9ecef;
  transform: translateX(4px);
}

.leaderboard-entry.top-three {
  background: linear-gradient(135deg, #fff8e1 0%, #fff3cd 100%);
  border: 2px solid #ffc107;
}

.leaderboard-entry.top-three:hover {
  background: linear-gradient(135deg, #fff3cd 0%, #ffe082 100%);
}

.rank {
  font-size: 1.5rem;
  font-weight: bold;
  min-width: 50px;
  text-align: center;
  color: #667eea;
}

.medal {
  font-size: 2rem;
}

.player-info {
  flex: 1;
}

.screen-name {
  font-weight: 600;
  color: #333;
  font-size: 1.1rem;
}

.stats {
  font-size: 0.875rem;
  color: #6c757d;
}

.score {
  font-size: 1.5rem;
  font-weight: bold;
  color: #667eea;
  min-width: 80px;
  text-align: right;
}

@media (max-width: 768px) {
  .leaderboard {
    width: 340px;
    max-width: calc(100vw - 2rem);
    padding: 1rem;
  }

  .leaderboard h3 {
    font-size: 1.1rem;
    margin-bottom: 0.75rem;
  }

  .leaderboard-list {
    gap: 0.4rem;
  }

  .leaderboard-entry {
    gap: 0.5rem;
    padding: 0.5rem 0.6rem;
  }

  .leaderboard-entry:hover {
    transform: none;
  }

  .rank {
    font-size: 1rem;
    min-width: 30px;
  }

  .medal {
    font-size: 1.2rem;
  }

  .screen-name {
    font-size: 0.85rem;
  }

  .stats {
    font-size: 0.65rem;
  }

  .score {
    font-size: 1rem;
    min-width: 50px;
  }
}
</style>
