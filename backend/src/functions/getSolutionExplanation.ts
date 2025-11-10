import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb, USER_TABLE, GAME_SESSION_TABLE } from '../utils/dynamodb.js'
import { generateSolutionExplanation } from '../utils/bedrock.js'
import { sanitizeError, createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js'

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

    // Find the problem and attempt
    const problem = session.problems.find((p: any) => p.id === problemId)
    const attempt = session.attempts.find((a: any) => a.problemId === problemId)

    if (!problem || !attempt) {
      return createErrorResponse(404, 'Problem or attempt not found')
    }

    // Generate explanation using Bedrock
    const explanationData = await generateSolutionExplanation(
      problem.question,
      problem.correctAnswer,
      attempt.userAnswer,
      user.ageGroup
    )

    const explanation = {
      problemId,
      explanation: explanationData.explanation,
      steps: explanationData.steps || [],
      ageAppropriateInsight: explanationData.ageAppropriateInsight
    }

    return createSuccessResponse({ explanation })
  } catch (error) {
    return sanitizeError(error, 'getSolutionExplanation')
  }
}
