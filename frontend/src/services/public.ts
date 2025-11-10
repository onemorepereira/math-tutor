import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export interface LeaderboardEntry {
  rank: number
  screenName: string
  totalScore: number
  gamesPlayed: number
}

export interface ActivityStats {
  activityByDate: { [date: string]: number }
  totalGames: number
}

export const publicService = {
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const response = await axios.get(`${API_URL}/api/public/leaderboard`)
    return response.data.leaderboard
  },

  async getActivityStats(): Promise<ActivityStats> {
    const response = await axios.get(`${API_URL}/api/public/activity`)
    return response.data
  }
}
