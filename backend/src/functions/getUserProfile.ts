import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb, USER_TABLE } from '../utils/dynamodb.js'
import { sanitizeError, createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js'

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Extract Cognito user ID from the authorizer claims
    const cognitoId = event.requestContext.authorizer?.claims?.sub

    if (!cognitoId) {
      return createErrorResponse(401, 'Unauthorized')
    }

    // Query user by Cognito ID
    const result = await dynamodb.send(new QueryCommand({
      TableName: USER_TABLE,
      IndexName: 'CognitoIdIndex',
      KeyConditionExpression: 'cognitoId = :cognitoId',
      ExpressionAttributeValues: {
        ':cognitoId': cognitoId
      }
    }))

    if (!result.Items || result.Items.length === 0) {
      return createErrorResponse(404, 'User not found')
    }

    const user = result.Items[0]

    return createSuccessResponse({
      user: {
        id: user.userId,
        email: user.email,
        screenName: user.screenName,
        ageGroup: user.ageGroup,
        createdAt: user.createdAt,
        totalScore: user.totalScore ?? 0,
        gamesPlayed: user.gamesPlayed ?? 0
      }
    })
  } catch (error) {
    return sanitizeError(error, 'getUserProfile')
  }
}
