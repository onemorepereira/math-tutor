import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb, USER_TABLE, GAME_SESSION_TABLE } from '../utils/dynamodb.js'
import { sanitizeError, createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const cognitoId = event.requestContext.authorizer?.claims?.sub

    if (!cognitoId) {
      return createErrorResponse(401, 'Unauthorized')
    }

    const sessionId = event.pathParameters?.sessionId

    if (!sessionId) {
      return createErrorResponse(400, 'Session ID is required')
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

    // Get game session
    const sessionResult = await dynamodb.send(new GetCommand({
      TableName: GAME_SESSION_TABLE,
      Key: { sessionId }
    }))

    if (!sessionResult.Item) {
      return createErrorResponse(404, 'Game session not found')
    }

    const session = sessionResult.Item

    // Verify session belongs to user
    if (session.userId !== user.userId) {
      return createErrorResponse(403, 'Forbidden')
    }

    // Calculate scorecard
    const correctAnswers = session.attempts.filter((a: any) => a.isCorrect).length
    const incorrectAnswers = session.attempts.filter((a: any) => !a.isCorrect).length
    const hintsUsed = session.attempts.reduce((sum: number, a: any) => sum + a.hintsUsed, 0)
    const maxPossibleScore = session.problems.reduce((sum: number, p: any) => sum + p.maxPoints, 0)

    const scorecard = {
      sessionId,
      totalScore: session.totalScore,
      maxPossibleScore,
      totalTimeSeconds: session.totalTimeSeconds,
      correctAnswers,
      incorrectAnswers,
      hintsUsed,
      attempts: session.attempts
    }

    // Mark session as completed
    await dynamodb.send(new UpdateCommand({
      TableName: GAME_SESSION_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET isCompleted = :completed, endTime = :endTime',
      ExpressionAttributeValues: {
        ':completed': true,
        ':endTime': new Date().toISOString()
      }
    }))

    // Update user stats
    await dynamodb.send(new UpdateCommand({
      TableName: USER_TABLE,
      Key: { userId: user.userId },
      UpdateExpression: 'SET gamesPlayed = gamesPlayed + :inc, totalScore = totalScore + :score',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':score': session.totalScore
      }
    }))

    return createSuccessResponse({ scorecard })
  } catch (error) {
    return sanitizeError(error, 'endGameSession')
  }
}
