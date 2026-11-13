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
  // Older sessions have no hint map yet: create it, then set this problem's entry
  expect(updates).toHaveLength(2)
  expect(updates[0].args[0].input.UpdateExpression).toContain('if_not_exists(hintsRequested')
  const record = updates[1].args[0].input
  expect(record.UpdateExpression).toBe('SET hintsRequested.#problemId = :hintNumber')
  expect(record.ExpressionAttributeNames).toEqual({ '#problemId': 'problem-1' })
  expect(record.ExpressionAttributeValues).toMatchObject({ ':hintNumber': 1 })
})

test('writes only this problem\'s entry so concurrent hints on other problems survive', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession({ hintsRequested: { 'problem-0': 2 } }) })

  const response = await handler(makeEvent(1))

  expect(response.statusCode).toBe(200)
  const updates = ddbMock.commandCalls(UpdateCommand, { TableName: 'TestSessions' })
  expect(updates).toHaveLength(1)
  expect(updates[0].args[0].input.UpdateExpression).toBe('SET hintsRequested.#problemId = :hintNumber')
  expect(JSON.stringify(updates[0].args[0].input)).not.toContain('problem-0')
})

test('never lowers a recorded hint and never writes to a completed session', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession({ hintsRequested: { 'problem-1': 2 } }) })
  const conditionalError = new Error('The conditional request failed')
  conditionalError.name = 'ConditionalCheckFailedException'
  ddbMock.on(UpdateCommand).rejects(conditionalError)

  const response = await handler(makeEvent(1))

  // The higher hint (or completion) already stands; the hint text is still served
  expect(response.statusCode).toBe(200)
  const record = ddbMock.commandCalls(UpdateCommand, { TableName: 'TestSessions' })[0].args[0].input
  expect(record.ConditionExpression).toBe(
    'isCompleted = :notCompleted AND (attribute_not_exists(hintsRequested.#problemId) OR hintsRequested.#problemId < :hintNumber)'
  )
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
