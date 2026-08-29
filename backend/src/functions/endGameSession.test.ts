import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { handler } from './endGameSession.js'

const ddbMock = mockClient(DynamoDBDocumentClient)

const user = { userId: 'user-1', cognitoId: 'cognito-1' }

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    problems: [{ id: 'problem-1', maxPoints: 20 }],
    attempts: [{ problemId: 'problem-1', isCorrect: true, hintsUsed: 1, pointsEarned: 15 }],
    totalScore: 15,
    totalTimeSeconds: 30,
    isCompleted: false,
    ...overrides
  }
}

const event = {
  pathParameters: { sessionId: 'session-1' },
  requestContext: { authorizer: { claims: { sub: 'cognito-1' } } }
} as unknown as APIGatewayProxyEvent

beforeEach(() => {
  ddbMock.reset()
  ddbMock.on(QueryCommand).resolves({ Items: [user] })
  ddbMock.on(UpdateCommand).resolves({})
})

test('completes a session and credits user stats exactly once', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession() })

  const response = await handler(event)

  expect(response.statusCode).toBe(200)
  expect(JSON.parse(response.body).scorecard.totalScore).toBe(15)
  const userUpdates = ddbMock.commandCalls(UpdateCommand, { TableName: 'TestUsers' })
  expect(userUpdates).toHaveLength(1)
  expect(userUpdates[0].args[0].input.ExpressionAttributeValues).toMatchObject({ ':score': 15 })
})

test('returns the scorecard without crediting user stats when the session is already completed', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession({ isCompleted: true }) })

  const response = await handler(event)

  expect(response.statusCode).toBe(200)
  expect(JSON.parse(response.body).scorecard.totalScore).toBe(15)
  expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0)
})

test('does not credit user stats when a concurrent call completes the session first', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession() })
  const conditionalError = new Error('The conditional request failed')
  conditionalError.name = 'ConditionalCheckFailedException'
  ddbMock.on(UpdateCommand, { TableName: 'TestSessions' }).rejects(conditionalError)

  const response = await handler(event)

  expect(response.statusCode).toBe(200)
  expect(JSON.parse(response.body).scorecard.totalScore).toBe(15)
  expect(ddbMock.commandCalls(UpdateCommand, { TableName: 'TestUsers' })).toHaveLength(0)
})
