import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { sanitizeError, createSuccessResponse } from '../utils/errorHandler.js'
import { getCachedData } from '../utils/cache.js'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Read from cache
    const leaderboard = await getCachedData('leaderboard')

    if (leaderboard === null) {
      // Cache miss - return empty for now
      // The scheduled function will populate it soon
      return createSuccessResponse({ leaderboard: [] })
    }

    return createSuccessResponse({ leaderboard })
  } catch (error) {
    return sanitizeError(error, 'getLeaderboard')
  }
}
