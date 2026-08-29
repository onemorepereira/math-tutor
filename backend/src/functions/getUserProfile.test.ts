import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { handler } from './getUserProfile.js'

const ddbMock = mockClient(DynamoDBDocumentClient)

const event = {
  requestContext: { authorizer: { claims: { sub: 'cognito-1' } } }
} as unknown as APIGatewayProxyEvent

beforeEach(() => {
  ddbMock.reset()
  ddbMock.on(QueryCommand).resolves({
    Items: [{
      userId: 'user-1',
      cognitoId: 'cognito-1',
      email: 'kid@example.com',
      screenName: 'CleverFox42',
      ageGroup: 'middle',
      createdAt: '2026-01-01T00:00:00.000Z',
      totalScore: 1234,
      gamesPlayed: 17
    }]
  })
})

test('includes lifetime totalScore and gamesPlayed in the profile', async () => {
  const response = await handler(event)

  expect(response.statusCode).toBe(200)
  const { user } = JSON.parse(response.body)
  expect(user.totalScore).toBe(1234)
  expect(user.gamesPlayed).toBe(17)
  expect(user.ageGroup).toBe('middle')
})
