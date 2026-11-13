import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
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

    // Completion and the user credit commit together, conditioned on the
    // attempts we scored, so the credit always matches the scorecard and a
    // failure between the two writes can never lose or double the credit.
    // If an answer lands in between, re-read and score again.
    for (let round = 0; round < MAX_COMPLETION_ROUNDS; round++) {
      const sessionResult = await dynamodb.send(new GetCommand({
        TableName: GAME_SESSION_TABLE,
        Key: { sessionId },
        ConsistentRead: true
      }))

      if (!sessionResult.Item) {
        return createErrorResponse(404, 'Game session not found')
      }

      const session = sessionResult.Item

      // Verify session belongs to user
      if (session.userId !== user.userId) {
        return createErrorResponse(403, 'Forbidden')
      }

      const scorecard = buildScorecard(sessionId, session)

      // Ending an already-completed session is a no-op: return the scorecard
      // without crediting user stats again (prevents score replay)
      if (session.isCompleted) {
        return createSuccessResponse({ scorecard })
      }

      try {
        await dynamodb.send(new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: GAME_SESSION_TABLE,
                Key: { sessionId },
                UpdateExpression: 'SET isCompleted = :completed, endTime = :endTime',
                ConditionExpression: 'isCompleted = :notCompleted AND size(attempts) = :attemptCount',
                ExpressionAttributeValues: {
                  ':completed': true,
                  ':notCompleted': false,
                  ':attemptCount': session.attempts.length,
                  ':endTime': new Date().toISOString()
                }
              }
            },
            {
              Update: {
                TableName: USER_TABLE,
                Key: { userId: user.userId },
                UpdateExpression: 'SET gamesPlayed = gamesPlayed + :inc, totalScore = totalScore + :score',
                ExpressionAttributeValues: {
                  ':inc': 1,
                  ':score': session.totalScore
                }
              }
            }
          ]
        }))
        return createSuccessResponse({ scorecard })
      } catch (error: any) {
        // The session changed under us (completed elsewhere, or a late
        // answer): loop to re-read and decide again
        if (error?.name !== 'TransactionCanceledException') {
          throw error
        }
      }
    }

    return createErrorResponse(409, 'The game session changed while ending it, please try again')
  } catch (error) {
    return sanitizeError(error, 'endGameSession')
  }
}

const MAX_COMPLETION_ROUNDS = 3

function buildScorecard(sessionId: string, session: Record<string, any>) {
  return {
    sessionId,
    totalScore: session.totalScore,
    maxPossibleScore: session.problems.reduce((sum: number, p: any) => sum + p.maxPoints, 0),
    totalTimeSeconds: session.totalTimeSeconds,
    correctAnswers: session.attempts.filter((a: any) => a.isCorrect).length,
    incorrectAnswers: session.attempts.filter((a: any) => !a.isCorrect).length,
    hintsUsed: session.attempts.reduce((sum: number, a: any) => sum + a.hintsUsed, 0),
    attempts: session.attempts
  }
}
