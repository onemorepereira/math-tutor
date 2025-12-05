import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb, USER_TABLE, GAME_SESSION_TABLE } from '../utils/dynamodb.js'
import { sanitizeError, createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js'
import { validateAnswer, validateHintsUsed, validateTimeSpent } from '../utils/validation.js'

function normalizeAnswer(answer: string): string {
  return answer.toString().toLowerCase().trim().replace(/\s+/g, '')
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b !== 0) {
    const temp = b
    b = a % b
    a = temp
  }
  return a
}

function parseFraction(str: string): { numerator: number; denominator: number } | null {
  const normalized = str.trim().replace(/\s+/g, '')
  const match = normalized.match(/^(-?\d+)\/(-?\d+)$/)
  if (!match) return null

  const numerator = parseInt(match[1], 10)
  const denominator = parseInt(match[2], 10)

  if (denominator === 0 || isNaN(numerator) || isNaN(denominator)) return null

  return { numerator, denominator }
}

function simplifyFraction(numerator: number, denominator: number): { numerator: number; denominator: number } {
  const divisor = gcd(numerator, denominator)
  let simplifiedNum = numerator / divisor
  let simplifiedDen = denominator / divisor

  // Ensure denominator is positive (move negative sign to numerator)
  if (simplifiedDen < 0) {
    simplifiedNum = -simplifiedNum
    simplifiedDen = -simplifiedDen
  }

  return { numerator: simplifiedNum, denominator: simplifiedDen }
}

function areFractionsEquivalent(answer: string, correctAnswer: string): boolean {
  const userFraction = parseFraction(answer)
  const correctFraction = parseFraction(correctAnswer)

  if (!userFraction || !correctFraction) return false

  const simplifiedUser = simplifyFraction(userFraction.numerator, userFraction.denominator)
  const simplifiedCorrect = simplifyFraction(correctFraction.numerator, correctFraction.denominator)

  return simplifiedUser.numerator === simplifiedCorrect.numerator &&
         simplifiedUser.denominator === simplifiedCorrect.denominator
}

function checkAnswerCorrect(userAnswer: string, correctAnswer: string): boolean {
  // First try exact match (normalized)
  if (normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer)) {
    return true
  }

  // Then try fraction equivalence
  if (areFractionsEquivalent(userAnswer, correctAnswer)) {
    return true
  }

  return false
}

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

    // Find the problem
    const problem = session.problems.find((p: any) => p.id === problemId)

    if (!problem) {
      return createErrorResponse(404, 'Problem not found')
    }

    // Check if answer is correct (handles exact match and fraction equivalence)
    const isCorrect = checkAnswerCorrect(answer, problem.correctAnswer)

    // Calculate points
    let pointsEarned = 0
    if (isCorrect) {
      pointsEarned = problem.maxPoints - (hintsUsed * 5)
      pointsEarned = Math.max(pointsEarned, 0) // Ensure points don't go negative
    }

    // Create attempt record
    const attempt = {
      problemId,
      problem,
      userAnswer: answer,
      isCorrect,
      hintsUsed,
      timeSpentSeconds: timeSpent,
      pointsEarned,
      timestamp: new Date().toISOString()
    }

    // Update session
    const newAttempts = [...session.attempts, attempt]
    const newTotalScore = session.totalScore + pointsEarned
    const newTotalTime = session.totalTimeSeconds + timeSpent

    await dynamodb.send(new UpdateCommand({
      TableName: GAME_SESSION_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET attempts = :attempts, totalScore = :totalScore, totalTimeSeconds = :totalTime, currentProblemIndex = :currentIndex',
      ExpressionAttributeValues: {
        ':attempts': newAttempts,
        ':totalScore': newTotalScore,
        ':totalTime': newTotalTime,
        ':currentIndex': session.currentProblemIndex + 1
      }
    }))

    return createSuccessResponse({
      isCorrect,
      pointsEarned,
      correctAnswer: problem.correctAnswer
    })
  } catch (error) {
    return sanitizeError(error, 'submitAnswer')
  }
}
