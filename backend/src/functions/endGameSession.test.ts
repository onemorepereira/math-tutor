import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
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
  ddbMock.on(TransactWriteCommand).resolves({})
})

function cancelled() {
  const error = new Error('Transaction cancelled')
  error.name = 'TransactionCanceledException'
  return error
}

function transactItems(call = 0) {
  return ddbMock.commandCalls(TransactWriteCommand)[call].args[0].input.TransactItems!
}

test('completes the session and credits the user in one transaction', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession() })

  const response = await handler(event)

  expect(response.statusCode).toBe(200)
  expect(JSON.parse(response.body).scorecard.totalScore).toBe(15)
  const [sessionUpdate, userUpdate] = transactItems().map(item => item.Update!)
  expect(sessionUpdate.TableName).toBe('TestSessions')
  expect(sessionUpdate.ConditionExpression).toBe('isCompleted = :notCompleted AND size(attempts) = :attemptCount')
  expect(sessionUpdate.ExpressionAttributeValues).toMatchObject({ ':attemptCount': 1 })
  expect(userUpdate.TableName).toBe('TestUsers')
  expect(userUpdate.ExpressionAttributeValues).toMatchObject({ ':score': 15 })
  expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0)
})

test('returns the scorecard without crediting user stats when the session is already completed', async () => {
  ddbMock.on(GetCommand).resolves({ Item: makeSession({ isCompleted: true }) })

  const response = await handler(event)

  expect(response.statusCode).toBe(200)
  expect(JSON.parse(response.body).scorecard.totalScore).toBe(15)
  expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0)
})

test('does not credit again when a concurrent call completes the session first', async () => {
  ddbMock.on(GetCommand)
    .resolvesOnce({ Item: makeSession() })
    .resolves({ Item: makeSession({ isCompleted: true }) })
  ddbMock.on(TransactWriteCommand).rejects(cancelled())

  const response = await handler(event)

  expect(response.statusCode).toBe(200)
  expect(JSON.parse(response.body).scorecard.totalScore).toBe(15)
  expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(1)
})

test('credits the score of the latest attempts when an answer lands mid-completion', async () => {
  const lateAttempt = { problemId: 'problem-2', isCorrect: true, hintsUsed: 0, pointsEarned: 20 }
  ddbMock.on(GetCommand)
    .resolvesOnce({ Item: makeSession() })
    .resolves({
      Item: makeSession({
        problems: [{ id: 'problem-1', maxPoints: 20 }, { id: 'problem-2', maxPoints: 20 }],
        attempts: [...makeSession().attempts, lateAttempt],
        totalScore: 35
      })
    })
  ddbMock.on(TransactWriteCommand).rejectsOnce(cancelled()).resolves({})

  const response = await handler(event)

  expect(response.statusCode).toBe(200)
  expect(JSON.parse(response.body).scorecard.totalScore).toBe(35)
  expect(transactItems(1)[1].Update!.ExpressionAttributeValues).toMatchObject({ ':score': 35 })
})
