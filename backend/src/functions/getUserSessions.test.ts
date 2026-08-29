import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { handler } from './getUserSessions.js'

const ddbMock = mockClient(DynamoDBDocumentClient)

const user = { userId: 'user-1', cognitoId: 'cognito-1' }

function makeSession(difficulty: string, topics: string[], correct: boolean[]) {
  const problems = topics.map((topic, i) => ({
    id: `p${i}`,
    topic,
    difficulty,
    maxPoints: 10,
    question: 'q',
    correctAnswer: 'a'
  }))
  return {
    sessionId: `${difficulty}-${topics.join('-')}`,
    userId: 'user-1',
    difficulty,
    startTime: new Date().toISOString(),
    problems,
    attempts: problems.map((p, i) => ({
      problemId: p.id,
      isCorrect: correct[i],
      hintsUsed: 0,
      timeSpentSeconds: 10,
      pointsEarned: correct[i] ? 10 : 0
    })),
    totalScore: 10,
    totalTimeSeconds: 20,
    isCompleted: true
  }
}

const event = {
  requestContext: { authorizer: { claims: { sub: 'cognito-1' } } }
} as unknown as APIGatewayProxyEvent

beforeEach(() => {
  ddbMock.reset()
  ddbMock.on(QueryCommand, { TableName: 'TestUsers' }).resolves({ Items: [user] })
})

test('topic performance is normalized and tracked per grade', async () => {
  ddbMock.on(QueryCommand, { TableName: 'TestSessions' }).resolves({
    Items: [
      makeSession('elementary', ['Fractions (Halves)', 'Fraction Comparison'], [true, false]),
      makeSession('middle', ['Fractions to Decimals', 'Geometry - Area'], [true, true])
    ]
  })

  const response = await handler(event)

  expect(response.statusCode).toBe(200)
  const { statistics } = JSON.parse(response.body)
  const fractionRows = statistics.topicPerformance.filter((t: any) => t.topic === 'Fractions')

  // One merged Fractions row per grade, not four fragmented labels
  expect(fractionRows).toHaveLength(2)
  const elementaryRow = fractionRows.find((t: any) => t.difficulty === 'elementary')
  expect(elementaryRow.problemCount).toBe(2)
  expect(elementaryRow.correctCount).toBe(1)
  const middleRow = fractionRows.find((t: any) => t.difficulty === 'middle')
  expect(middleRow.problemCount).toBe(1)
  expect(statistics.topicPerformance.find((t: any) => t.topic === 'Geometry')?.difficulty).toBe('middle')
})

test('per-grade achievements unlock from sessions at that grade', async () => {
  ddbMock.on(QueryCommand, { TableName: 'TestSessions' }).resolves({
    Items: [makeSession('middle', ['Decimals'], [true])]
  })

  const response = await handler(event)

  const { statistics } = JSON.parse(response.body)
  const byId = Object.fromEntries(statistics.achievements.map((a: any) => [a.id, a.unlocked]))
  expect(byId['middle_first']).toBe(true)
  expect(byId['elementary_first']).toBe(false)
  expect(byId['middle_ten']).toBe(false)
})
