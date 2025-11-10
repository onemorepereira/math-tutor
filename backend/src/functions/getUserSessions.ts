import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb, USER_TABLE, GAME_SESSION_TABLE } from '../utils/dynamodb.js'
import { sanitizeError, createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const cognitoId = event.requestContext.authorizer?.claims?.sub

    if (!cognitoId) {
      return createErrorResponse(401, 'Unauthorized')
    }

    // Get user info
    const userResult = await dynamodb.send(new QueryCommand({
      TableName: USER_TABLE,
      IndexName: 'CognitoIdIndex',
      KeyConditionExpression: 'cognitoId = :cognitoId',
      ExpressionAttributeValues: {
        ':cognitoId': cognitoId
      }
    }))

    if (!userResult.Items || userResult.Items.length === 0) {
      return createErrorResponse(404, 'User not found')
    }

    const user = userResult.Items[0]

    // Get user's game sessions
    const sessionsResult = await dynamodb.send(new QueryCommand({
      TableName: GAME_SESSION_TABLE,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': user.userId
      }
    }))

    // Sort sessions by startTime in descending order (newest first)
    const sessions = (sessionsResult.Items || []).sort((a: any, b: any) => {
      const dateA = new Date(a.startTime).getTime()
      const dateB = new Date(b.startTime).getTime()
      return dateB - dateA
    })

    // Calculate statistics
    const completedSessions = sessions.filter((s: any) => s.isCompleted)
    const totalSessions = completedSessions.length
    const totalProblems = completedSessions.reduce((sum: number, s: any) => sum + s.attempts.length, 0)
    const correctProblems = completedSessions.reduce((sum: number, s: any) =>
      sum + s.attempts.filter((a: any) => a.isCorrect).length, 0)
    const totalScore = completedSessions.reduce((sum: number, s: any) => sum + s.totalScore, 0)
    const averageScore = totalSessions > 0 ? Math.round(totalScore / totalSessions) : 0
    const accuracy = totalProblems > 0 ? Math.round((correctProblems / totalProblems) * 100) : 0
    const perfectScores = completedSessions.filter((s: any) => {
      const maxPossible = s.problems.reduce((sum: number, p: any) => sum + p.maxPoints, 0)
      return s.totalScore === maxPossible
    }).length

    // Define all achievements with unlock conditions
    const allAchievements = [
      { id: 'first_game', name: 'First Game', description: 'Complete your first game session', condition: totalSessions >= 1 },
      { id: 'dedicated', name: 'Dedicated Learner', description: 'Complete 10 game sessions', condition: totalSessions >= 10 },
      { id: 'math_master', name: 'Math Master', description: 'Complete 50 game sessions', condition: totalSessions >= 50 },
      { id: 'perfect', name: 'Perfect Score', description: 'Get a perfect score', condition: perfectScores >= 1 },
      { id: 'perfectionist', name: 'Perfectionist', description: 'Get 10 perfect scores', condition: perfectScores >= 10 },
      { id: 'century', name: 'Century Club', description: 'Solve 100 problems', condition: totalProblems >= 100 },
      { id: 'expert', name: 'Expert Mathematician', description: 'Solve 500 problems', condition: totalProblems >= 500 },
      { id: 'accurate', name: 'Sharp Shooter', description: 'Maintain 90%+ accuracy', condition: accuracy >= 90 && totalProblems >= 10 }
    ]

    // Map achievements with unlocked status
    const achievements = allAchievements.map(achievement => ({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      unlocked: achievement.condition
    }))

    // Calculate average time and accuracy by topic
    const topicData: Record<string, { totalTime: number, count: number, correct: number }> = {}

    completedSessions.forEach((session: any) => {
      session.attempts.forEach((attempt: any) => {
        // Find the problem to get the topic
        const problem = session.problems.find((p: any) => p.id === attempt.problemId)
        if (problem && problem.topic) {
          if (!topicData[problem.topic]) {
            topicData[problem.topic] = { totalTime: 0, count: 0, correct: 0 }
          }
          if (attempt.timeSpentSeconds) {
            topicData[problem.topic].totalTime += attempt.timeSpentSeconds
          }
          topicData[problem.topic].count += 1
          if (attempt.isCorrect) {
            topicData[problem.topic].correct += 1
          }
        }
      })
    })

    const topicPerformance = Object.entries(topicData).map(([topic, data]) => ({
      topic,
      totalSeconds: data.totalTime,
      averageSeconds: data.totalTime > 0 ? Math.round(data.totalTime / data.count) : 0,
      problemCount: data.count,
      correctCount: data.correct,
      accuracy: Math.round((data.correct / data.count) * 100)
    })).sort((a, b) => a.accuracy - b.accuracy) // Sort by lowest accuracy first (weakest topics)

    // Calculate daily activity for the current year
    const currentYear = new Date().getFullYear()
    const dailyActivity: Record<string, { sessionCount: number, totalTime: number }> = {}

    completedSessions.forEach((session: any) => {
      const sessionDate = new Date(session.startTime)
      if (sessionDate.getFullYear() === currentYear) {
        const dateKey = sessionDate.toISOString().split('T')[0] // YYYY-MM-DD
        if (!dailyActivity[dateKey]) {
          dailyActivity[dateKey] = { sessionCount: 0, totalTime: 0 }
        }
        dailyActivity[dateKey].sessionCount += 1
        dailyActivity[dateKey].totalTime += session.totalTimeSeconds || 0
      }
    })

    const statistics = {
      totalSessions,
      totalProblems,
      correctProblems,
      accuracy,
      totalScore,
      averageScore,
      perfectScores,
      achievements,
      topicPerformance,
      dailyActivity
    }

    return createSuccessResponse({
      statistics,
      sessions: sessions.map((s: any) => ({
        sessionId: s.sessionId,
        difficulty: s.difficulty,
        subcategories: s.subcategories,
        startTime: s.startTime,
        endTime: s.endTime,
        totalScore: s.totalScore,
        isCompleted: s.isCompleted,
        problemCount: s.problems.length,
        correctCount: s.attempts.filter((a: any) => a.isCorrect).length,
        totalTimeSeconds: s.totalTimeSeconds
      }))
    })
  } catch (error) {
    return sanitizeError(error, 'getUserSessions')
  }
}
