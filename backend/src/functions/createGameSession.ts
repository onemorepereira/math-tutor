import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { dynamodb, USER_TABLE, GAME_SESSION_TABLE } from '../utils/dynamodb.js'
import { generateMathProblems } from '../utils/bedrock.js'
import { sanitizeError, createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js'
import { validateDifficulty, validateProblemCount, validateSubcategories } from '../utils/validation.js'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const cognitoId = event.requestContext.authorizer?.claims?.sub

    if (!cognitoId) {
      return createErrorResponse(401, 'Unauthorized')
    }

    if (!event.body) {
      return createErrorResponse(400, 'Request body is required')
    }

    const { difficulty, problemCount = 10, subcategories } = JSON.parse(event.body)

    // Validate difficulty
    const difficultyValidation = validateDifficulty(difficulty)
    if (!difficultyValidation.isValid) {
      return createErrorResponse(400, difficultyValidation.error!)
    }

    // Validate problem count
    const problemCountValidation = validateProblemCount(problemCount)
    if (!problemCountValidation.isValid) {
      return createErrorResponse(400, problemCountValidation.error!)
    }

    // Validate subcategories
    const subcategoriesValidation = validateSubcategories(subcategories)
    if (!subcategoriesValidation.isValid) {
      return createErrorResponse(400, subcategoriesValidation.error!)
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

    // Generate math problems using Bedrock
    const generatedProblems = await generateMathProblems(difficulty, problemCount, subcategories)

    // Add IDs to problems
    const problems = generatedProblems.map((p: any) => ({
      id: uuidv4(),
      question: p.question,
      correctAnswer: p.correctAnswer,
      difficulty,
      topic: p.topic,
      maxPoints: p.maxPoints
    }))

    const sessionId = uuidv4()
    const session = {
      sessionId,
      userId: user.userId,
      startTime: new Date().toISOString(),
      difficulty,
      ...(subcategories && subcategories.length > 0 && { subcategories }),
      problems,
      attempts: [],
      currentProblemIndex: 0,
      totalScore: 0,
      totalTimeSeconds: 0,
      isCompleted: false
    }

    await dynamodb.send(new PutCommand({
      TableName: GAME_SESSION_TABLE,
      Item: session
    }))

    return createSuccessResponse({ session }, 201)
  } catch (error) {
    return sanitizeError(error, 'createGameSession')
  }
}
