import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { ScheduledEvent } from 'aws-lambda'
import { handler } from './updatePublicStatsCache.js'

const ddbMock = mockClient(DynamoDBDocumentClient)

function cachedData(key: string) {
  const put = ddbMock.commandCalls(PutCommand).find(c => c.args[0].input.Item?.cacheKey === key)
  return put?.args[0].input.Item
}

beforeEach(() => {
  ddbMock.reset()
  ddbMock.on(PutCommand).resolves({})
})

test('leaderboard and activity stats include every scanned page', async () => {
  ddbMock.on(ScanCommand, { TableName: 'TestUsers' })
    .resolvesOnce({
      Items: [{ screenName: 'low', totalScore: 10, gamesPlayed: 1 }],
      LastEvaluatedKey: { userId: 'u1' }
    })
    .resolvesOnce({
      Items: [{ screenName: 'top', totalScore: 500, gamesPlayed: 9 }]
    })
  ddbMock.on(ScanCommand, { TableName: 'TestSessions' })
    .resolvesOnce({
      Items: [{ endTime: '2026-11-10T12:00:00.000Z', totalScore: 10 }],
      LastEvaluatedKey: { sessionId: 's1' }
    })
    .resolvesOnce({
      Items: [{ endTime: '2026-11-11T12:00:00.000Z', totalScore: 20 }]
    })

  await handler({} as ScheduledEvent)

  expect(cachedData('leaderboard')?.data.map((u: any) => u.screenName)).toEqual(['top', 'low'])
  expect(cachedData('activity')?.data.totalGames).toBe(2)
  expect(cachedData('activity')?.data.activityByDate).toEqual({ '2026-11-10': 1, '2026-11-11': 1 })
})

test('cached entries outlive at least two refresh periods', async () => {
  ddbMock.on(ScanCommand).resolves({ Items: [] })
  const before = Math.floor(Date.now() / 1000)

  await handler({} as ScheduledEvent)

  const refreshPeriodSeconds = 15 * 60
  expect(cachedData('leaderboard')?.ttl).toBeGreaterThanOrEqual(before + 2 * refreshPeriodSeconds)
})
