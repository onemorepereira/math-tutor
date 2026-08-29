import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { handler } from './getGameSession.js'

const ddbMock = mockClient(DynamoDBDocumentClient)

const user = { userId: 'user-1', cognitoId: 'cognito-1' }

const session = {
  sessionId: 'session-1',
  userId: 'user-1',
  difficulty: 'middle',
  problems: [{ id: 'problem-1', question: 'What is 25% of 80?', correctAnswer: '20', maxPoints: 15 }],
  attempts: [],
  currentProblemIndex: 0,
  totalScore: 0,
  totalTimeSeconds: 0,
  isCompleted: false,
  hintsRequested: { 'problem-1': 1 }
}

function makeEvent(sub: string | null = 'cognito-1'): APIGatewayProxyEvent {
  return {
    pathParameters: { sessionId: 'session-1' },
    requestContext: { authorizer: sub ? { claims: { sub } } : undefined }
  } as unknown as APIGatewayProxyEvent
}

beforeEach(() => {
  ddbMock.reset()
  ddbMock.on(QueryCommand).resolves({ Items: [user] })
  ddbMock.on(GetCommand).resolves({ Item: session })
})

test('returns the full session, including hint records, to its owner', async () => {
  const response = await handler(makeEvent())

  expect(response.statusCode).toBe(200)
  const body = JSON.parse(response.body)
  expect(body.session.sessionId).toBe('session-1')
  expect(body.session.problems).toHaveLength(1)
  expect(body.session.hintsRequested).toEqual({ 'problem-1': 1 })
})

test('returns 403 for a session owned by another user', async () => {
  ddbMock.on(GetCommand).resolves({ Item: { ...session, userId: 'someone-else' } })

  const response = await handler(makeEvent())

  expect(response.statusCode).toBe(403)
})

test('returns 404 when the session does not exist', async () => {
  ddbMock.on(GetCommand).resolves({})

  const response = await handler(makeEvent())

  expect(response.statusCode).toBe(404)
})

test('returns 401 without authorizer claims', async () => {
  const response = await handler(makeEvent(null))

  expect(response.statusCode).toBe(401)
})
