import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb, USER_TABLE, GAME_SESSION_TABLE } from '../utils/dynamodb.js'
import { sanitizeError, createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js'
import { validateAnswer, validateHintsUsed, validateTimeSpent } from '../utils/validation.js'
import { checkAnswerCorrect } from '../utils/answerMatcher.js'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const cognitoId = event.requestContext.authorizer?.claims?.sub

    if (!cognitoId) {
      return createErrorResponse(401, 'Unauthorized')
    }

    const sessionId = event.pathParameters?.sessionId
    const problemId = event.pathParameters?.problemId

    if (!sessionId || !problemId) {
      return createErrorResponse(400, 'Session ID and Problem ID are required')
    }

    if (!event.body) {
      return createErrorResponse(400, 'Request body is required')
    }

    const { answer, hintsUsed, timeSpent } = JSON.parse(event.body)

    if (answer === undefined || hintsUsed === undefined || timeSpent === undefined) {
      return createErrorResponse(400, 'Answer, hintsUsed, and timeSpent are required')
    }

    // Validate answer
    const answerValidation = validateAnswer(answer)
    if (!answerValidation.isValid) {
      return createErrorResponse(400, answerValidation.error!)
    }

    // Validate hints used
    const hintsUsedValidation = validateHintsUsed(hintsUsed)
    if (!hintsUsedValidation.isValid) {
      return createErrorResponse(400, hintsUsedValidation.error!)
    }

    // Validate time spent
    const timeSpentValidation = validateTimeSpent(timeSpent)
    if (!timeSpentValidation.isValid) {
      return createErrorResponse(400, timeSpentValidation.error!)
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

    if (session.isCompleted) {
      return createErrorResponse(409, 'Game session is already completed')
    }

    if (session.attempts.some((a: any) => a.problemId === problemId)) {
      return createErrorResponse(409, 'This problem has already been answered')
    }

    // Find the problem
    const problem = session.problems.find((p: any) => p.id === problemId)

    if (!problem) {
      return createErrorResponse(404, 'Problem not found')
    }

    // Check if answer is correct (handles exact match and fraction equivalence)
    const isCorrect = checkAnswerCorrect(answer, problem.correctAnswer)

    // Hints are counted from the server-side record written by requestHint;
    // the client-supplied hintsUsed is accepted for API compatibility but not trusted.
    const hintsRecorded = Math.min(session.hintsRequested?.[problemId] ?? 0, 2)

    // Calculate points
    let pointsEarned = 0
    if (isCorrect) {
      pointsEarned = problem.maxPoints - (hintsRecorded * 5)
      pointsEarned = Math.max(pointsEarned, 0) // Ensure points don't go negative
    }

    // Create attempt record
    const attempt = {
      problemId,
      problem,
      userAnswer: answer,
      isCorrect,
      hintsUsed: hintsRecorded,
      timeSpentSeconds: timeSpent,
      pointsEarned,
      timestamp: new Date().toISOString()
    }

    // Append atomically, guarded against concurrent submissions for the same session
    try {
      await dynamodb.send(new UpdateCommand({
        TableName: GAME_SESSION_TABLE,
        Key: { sessionId },
        UpdateExpression: 'SET attempts = list_append(attempts, :newAttempt), totalScore = totalScore + :points, totalTimeSeconds = totalTimeSeconds + :time, currentProblemIndex = currentProblemIndex + :one',
        ConditionExpression: 'size(attempts) = :expectedAttempts AND isCompleted = :notCompleted',
        ExpressionAttributeValues: {
          ':newAttempt': [attempt],
          ':points': pointsEarned,
          ':time': timeSpent,
          ':one': 1,
          ':expectedAttempts': session.attempts.length,
          ':notCompleted': false
        }
      }))
    } catch (updateError: any) {
      if (updateError?.name === 'ConditionalCheckFailedException') {
        return createErrorResponse(409, 'Conflicting submission, please retry')
      }
      throw updateError
    }

    return createSuccessResponse({
      isCorrect,
      pointsEarned,
      correctAnswer: problem.correctAnswer
    })
  } catch (error) {
    return sanitizeError(error, 'submitAnswer')
  }
}
