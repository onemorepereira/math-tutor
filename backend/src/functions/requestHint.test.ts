import { jest } from '@jest/globals'
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

const generateHint = jest.fn<() => Promise<string>>().mockResolvedValue('Try counting by sixes')

jest.unstable_mockModule('../utils/bedrock.js', () => ({
  generateHint,
  generateMathProblems: jest.fn(),
  generateSolutionExplanation: jest.fn(),
  verifyTextAnswers: jest.fn()
}))

const ddbMock = mockClient(DynamoDBDocumentClient)

let handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>

beforeAll(async () => {
  ({ handler } = await import('./requestHint.js'))
})

const user = { userId: 'user-1', cognitoId: 'cognito-1', ageGroup: 'elementary' }

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    problems: [{ id: 'problem-1', question: 'What is 6 x 7?', correctAnswer: '42', maxPoints: 20 }],
    attempts: [],
    isCompleted: false,
    ...overrides
  }
}

function makeEvent(hintNumber: number): APIGatewayProxyEvent {
  return {
    body: JSON.stringify({ hintNumber }),
    pathParameters: { sessionId: 'session-1', problemId: 'problem-1' },
    requestContext: { authorizer: { claims: { sub: 'cognito-1' } } }
  } as unknown as APIGatewayProxyEvent
}

beforeEach(() => {
  ddbMock.reset()
  generateHint.mockClear()
  ddbMock.on(QueryCommand).resolves({ Items: [user] })
  ddbMock.on(UpdateCommand).resolves({})
})

test('records the requested hint on the session before returning it', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession() })

  const response = await handler(makeEvent(1))

  expect(response.statusCode).toBe(200)
  expect(JSON.parse(response.body).hint.content).toBe('Try counting by sixes')
  const updates = ddbMock.commandCalls(UpdateCommand, { TableName: 'TestSessions' })
  expect(updates).toHaveLength(1)
  expect(updates[0].args[0].input.ExpressionAttributeValues).toMatchObject({
    ':hintsRequested': { 'problem-1': 1 }
  })
})

test('keeps the higher hint number when a lower one is requested again', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession({ hintsRequested: { 'problem-1': 2 } }) })

  const response = await handler(makeEvent(1))

  expect(response.statusCode).toBe(200)
  const updates = ddbMock.commandCalls(UpdateCommand, { TableName: 'TestSessions' })
  expect(updates[0].args[0].input.ExpressionAttributeValues).toMatchObject({
    ':hintsRequested': { 'problem-1': 2 }
  })
})

test('rejects hint requests for an already-answered problem', async () => {
  ddbMock.on(GetCommand).resolves({
    Item: makeSession({ attempts: [{ problemId: 'problem-1', isCorrect: false }] })
  })

  const response = await handler(makeEvent(1))

  expect(response.statusCode).toBe(409)
  expect(generateHint).not.toHaveBeenCalled()
  expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0)
})

test('rejects hint requests for a completed session', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession({ isCompleted: true }) })

  const response = await handler(makeEvent(1))

  expect(response.statusCode).toBe(409)
  expect(generateHint).not.toHaveBeenCalled()
})
