import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import { dynamodb, USER_TABLE } from '../utils/dynamodb.js'
import { generateChildFriendlyUsername } from '../utils/usernameGenerator.js'
import { sanitizeError, createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js'
import { validateEmail, validateAgeGroup, validateCognitoId } from '../utils/validation.js'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Check if signups are enabled
    const allowSignups = process.env.ALLOW_SIGNUPS !== 'false'
    if (!allowSignups) {
      return createErrorResponse(403, 'New signups are currently disabled')
    }

    // Identity comes from the verified JWT, never from the request body
    const claims = event.requestContext.authorizer?.claims
    const cognitoId = claims?.sub
    const email = claims?.email

    if (!cognitoId || !email) {
      return createErrorResponse(401, 'Unauthorized')
    }

    if (!event.body) {
      return createErrorResponse(400, 'Request body is required')
    }

    const { ageGroup } = JSON.parse(event.body)

    if (!ageGroup) {
      return createErrorResponse(400, 'Missing required fields')
    }

    // Validate Cognito ID
    const cognitoIdValidation = validateCognitoId(cognitoId)
    if (!cognitoIdValidation.isValid) {
      return createErrorResponse(400, cognitoIdValidation.error!)
    }

    // Validate email
    const emailValidation = validateEmail(email)
    if (!emailValidation.isValid) {
      return createErrorResponse(400, emailValidation.error!)
    }

    // Validate age group
    const ageGroupValidation = validateAgeGroup(ageGroup)
    if (!ageGroupValidation.isValid) {
      return createErrorResponse(400, ageGroupValidation.error!)
    }

    // Registration is idempotent: one user record per Cognito identity
    const existingResult = await dynamodb.send(new QueryCommand({
      TableName: USER_TABLE,
      IndexName: 'CognitoIdIndex',
      KeyConditionExpression: 'cognitoId = :cognitoId',
      ExpressionAttributeValues: {
        ':cognitoId': cognitoId
      }
    }))

    if (existingResult.Items && existingResult.Items.length > 0) {
      const existing = existingResult.Items[0]
      return createSuccessResponse({
        success: true,
        user: {
          id: existing.userId,
          email: existing.email,
          screenName: existing.screenName,
          ageGroup: existing.ageGroup,
          createdAt: existing.createdAt
        }
      })
    }

    const userId = uuidv4()
    const screenName = generateChildFriendlyUsername()

    const user = {
      userId,
      cognitoId,
      email,
      screenName,
      ageGroup,
      createdAt: new Date().toISOString(),
      gamesPlayed: 0,
      totalScore: 0
    }

    await dynamodb.send(new PutCommand({
      TableName: USER_TABLE,
      Item: user
    }))

    return createSuccessResponse({
      success: true,
      user: {
        id: userId,
        email,
        screenName,
        ageGroup,
        createdAt: user.createdAt
      }
    }, 201)
  } catch (error) {
    return sanitizeError(error, 'register')
  }
}
