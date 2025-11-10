import axios from 'axios'
import type { GameSession, Hint, Scorecard, SolutionExplanation, DifficultyLevel } from '@/types'
import { authService } from './auth'

const API_URL = import.meta.env.VITE_API_URL || '/api'

async function getAuthHeaders() {
  const token = await authService.getIdToken()
  return {
    Authorization: `Bearer ${token}`
  }
}

export const gameService = {
  async createGameSession(difficulty: DifficultyLevel, problemCount: number = 10, subcategories?: string[]): Promise<GameSession> {
    const headers = await getAuthHeaders()
    const response = await axios.post(
      `${API_URL}/api/game/sessions`,
      { difficulty, problemCount, subcategories },
      { headers }
    )
    return response.data.session
  },

  async requestHint(sessionId: string, problemId: string, hintNumber: 1 | 2): Promise<Hint> {
    const headers = await getAuthHeaders()
    const response = await axios.post(
      `${API_URL}/api/game/sessions/${sessionId}/problems/${problemId}/hints`,
      { hintNumber },
      { headers }
    )
    return response.data.hint
  },

  async submitAnswer(
    sessionId: string,
    problemId: string,
    answer: string,
    hintsUsed: number,
    timeSpent: number
  ) {
    const headers = await getAuthHeaders()
    const response = await axios.post(
      `${API_URL}/api/game/sessions/${sessionId}/problems/${problemId}/submit`,
      {
        answer,
        hintsUsed,
        timeSpent
      },
      { headers }
    )
    return response.data
  },

  async endGameSession(sessionId: string): Promise<Scorecard> {
    const headers = await getAuthHeaders()
    const response = await axios.post(
      `${API_URL}/api/game/sessions/${sessionId}/end`,
      {},
      { headers }
    )
    return response.data.scorecard
  },

  async getSolutionExplanation(sessionId: string, problemId: string): Promise<SolutionExplanation> {
    const headers = await getAuthHeaders()
    const response = await axios.get(
      `${API_URL}/api/game/sessions/${sessionId}/problems/${problemId}/explanation`,
      { headers }
    )
    return response.data.explanation
  }
}
