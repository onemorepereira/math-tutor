import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { handler } from './submitAnswer.js'

const ddbMock = mockClient(DynamoDBDocumentClient)

const user = { userId: 'user-1', cognitoId: 'cognito-1', ageGroup: 'elementary' }

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    problems: [
      { id: 'problem-1', question: 'What is 6 x 7?', correctAnswer: '42', maxPoints: 20, answerType: 'numeric' }
    ],
    attempts: [],
    currentProblemIndex: 0,
    totalScore: 0,
    totalTimeSeconds: 0,
    isCompleted: false,
    ...overrides
  }
}

function makeEvent(body: Record<string, unknown>): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    pathParameters: { sessionId: 'session-1', problemId: 'problem-1' },
    requestContext: { authorizer: { claims: { sub: 'cognito-1' } } }
  } as unknown as APIGatewayProxyEvent
}

beforeEach(() => {
  ddbMock.reset()
  ddbMock.on(QueryCommand).resolves({ Items: [user] })
  ddbMock.on(UpdateCommand).resolves({})
})

test('accepts a first correct answer and awards full points', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession() })

  const response = await handler(makeEvent({ answer: '42', hintsUsed: 0, timeSpent: 12 }))

  expect(response.statusCode).toBe(200)
  const body = JSON.parse(response.body)
  expect(body.isCorrect).toBe(true)
  expect(body.pointsEarned).toBe(20)
})

test('rejects a second submission for a problem that already has an attempt', async () => {
  ddbMock.on(GetCommand).resolves({
    Item: makeSession({
      attempts: [{ problemId: 'problem-1', isCorrect: true, pointsEarned: 20, hintsUsed: 0 }]
    })
  })

  const response = await handler(makeEvent({ answer: '42', hintsUsed: 0, timeSpent: 5 }))

  expect(response.statusCode).toBe(409)
  expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0)
})

test('rejects submissions to a completed session', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession({ isCompleted: true }) })

  const response = await handler(makeEvent({ answer: '42', hintsUsed: 0, timeSpent: 5 }))

  expect(response.statusCode).toBe(409)
  expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0)
})

test('scores the hint penalty from the session hint record, not the client-supplied hintsUsed', async () => {
  ddbMock.on(GetCommand).resolves({
    Item: makeSession({ hintsRequested: { 'problem-1': 2 } })
  })

  const response = await handler(makeEvent({ answer: '42', hintsUsed: 0, timeSpent: 12 }))

  expect(response.statusCode).toBe(200)
  const body = JSON.parse(response.body)
  expect(body.isCorrect).toBe(true)
  expect(body.pointsEarned).toBe(10)
})

test('returns 409 when a concurrent write wins the optimistic lock', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession() })
  const conditionalError = new Error('The conditional request failed')
  conditionalError.name = 'ConditionalCheckFailedException'
  ddbMock.on(UpdateCommand).rejects(conditionalError)

  const response = await handler(makeEvent({ answer: '42', hintsUsed: 0, timeSpent: 12 }))

  expect(response.statusCode).toBe(409)
})
