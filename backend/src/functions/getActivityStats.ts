import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { sanitizeError, createSuccessResponse } from '../utils/errorHandler.js'
import { getCachedData } from '../utils/cache.js'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Read from cache
    const activityStats = await getCachedData('activity')

    if (activityStats === null) {
      // Cache miss - return empty for now
      // The scheduled function will populate it soon
      return createSuccessResponse({ activityByDate: {}, totalGames: 0 })
    }

    return createSuccessResponse(activityStats)
  } catch (error) {
    return sanitizeError(error, 'getActivityStats')
  }
}
