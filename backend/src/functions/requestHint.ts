import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb, USER_TABLE, GAME_SESSION_TABLE } from '../utils/dynamodb.js'
import { generateHint } from '../utils/bedrock.js'
import { sanitizeError, createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js'
import { validateHintNumber } from '../utils/validation.js'

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

    const { hintNumber } = JSON.parse(event.body)

    if (hintNumber === undefined) {
      return createErrorResponse(400, 'Hint number is required')
    }

    // Validate hint number
    const hintNumberValidation = validateHintNumber(hintNumber)
    if (!hintNumberValidation.isValid) {
      return createErrorResponse(400, hintNumberValidation.error!)
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

    // Generate hint using Bedrock
    const hintContent = await generateHint(
      problem.question,
      problem.correctAnswer,
      hintNumber,
      user.ageGroup
    )

    const hint = {
      hintNumber,
      content: hintContent,
      pointDeduction: 5
    }

    return createSuccessResponse({ hint })
  } catch (error) {
    return sanitizeError(error, 'requestHint')
  }
}
