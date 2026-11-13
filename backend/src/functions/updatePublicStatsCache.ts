import type { ScheduledEvent } from 'aws-lambda'
import { scanAll, USER_TABLE, GAME_SESSION_TABLE } from '../utils/dynamodb.js'
import { setCachedData } from '../utils/cache.js'

export async function handler(event: ScheduledEvent): Promise<void> {
  console.log('Updating public stats cache...')

  try {
    // Update leaderboard cache
    await updateLeaderboardCache()

    // Update activity stats cache
    await updateActivityStatsCache()

    console.log('Public stats cache updated successfully')
  } catch (error) {
    console.error('Failed to update public stats cache:', error)
    throw error
  }
}

async function updateLeaderboardCache(): Promise<void> {
  // Scan the user table to get all users
  const users = await scanAll({
    TableName: USER_TABLE,
    ProjectionExpression: 'screenName, totalScore, gamesPlayed'
  })

  // Sort by totalScore descending and take top 10
  const leaderboard = users
    .filter((user: any) => user.gamesPlayed > 0) // Only include users who have played
    .sort((a: any, b: any) => b.totalScore - a.totalScore)
    .slice(0, 10)
    .map((user: any, index: number) => ({
      rank: index + 1,
      screenName: user.screenName,
      totalScore: user.totalScore,
      gamesPlayed: user.gamesPlayed
    }))

  await setCachedData('leaderboard', leaderboard)
  console.log(`Leaderboard cache updated with ${leaderboard.length} entries`)
}

async function updateActivityStatsCache(): Promise<void> {
  // Scan the game session table to get completed sessions
  const sessions = await scanAll({
    TableName: GAME_SESSION_TABLE,
    FilterExpression: 'isCompleted = :completed AND attribute_exists(endTime)',
    ExpressionAttributeValues: {
      ':completed': true
    },
    ProjectionExpression: 'endTime, totalScore'
  })

  if (sessions.length === 0) {
    await setCachedData('activity', { activityByDate: {}, totalGames: 0 })
    return
  }

  // Aggregate games by date
  const activityByDate: { [date: string]: number } = {}

  sessions.forEach((session: any) => {
    if (session.endTime) {
      // Extract date from ISO timestamp (YYYY-MM-DD)
      const date = session.endTime.split('T')[0]
      activityByDate[date] = (activityByDate[date] || 0) + 1
    }
  })

  const activityStats = {
    activityByDate,
    totalGames: sessions.length
  }

  await setCachedData('activity', activityStats)
  console.log(`Activity stats cache updated with ${sessions.length} total games`)
}
