import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { handler } from './register.js'

const ddbMock = mockClient(DynamoDBDocumentClient)

function makeEvent(
  body: Record<string, unknown>,
  claims: Record<string, string> | null = { sub: '11111111-2222-3333-4444-555555555555', email: 'kid@example.com' }
): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    requestContext: { authorizer: claims ? { claims } : undefined }
  } as unknown as APIGatewayProxyEvent
}

beforeEach(() => {
  ddbMock.reset()
  ddbMock.on(QueryCommand).resolves({ Items: [] })
  ddbMock.on(PutCommand).resolves({})
})

test('creates the user from the JWT claims, ignoring identity fields in the body', async () => {
  const response = await handler(makeEvent({
    cognitoId: '99999999-8888-7777-6666-555555555555',
    email: 'attacker@example.com',
    ageGroup: 'elementary'
  }))

  expect(response.statusCode).toBe(201)
  const puts = ddbMock.commandCalls(PutCommand)
  expect(puts).toHaveLength(1)
  expect(puts[0].args[0].input.Item).toMatchObject({
    cognitoId: '11111111-2222-3333-4444-555555555555',
    email: 'kid@example.com',
    ageGroup: 'elementary'
  })
})

test('returns 401 when the request has no authorizer claims', async () => {
  const response = await handler(makeEvent({ ageGroup: 'elementary' }, null))

  expect(response.statusCode).toBe(401)
  expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0)
})

test('returns the existing user instead of creating a duplicate for the same cognitoId', async () => {
  ddbMock.on(QueryCommand).resolves({
    Items: [{
      userId: 'existing-user',
      cognitoId: '11111111-2222-3333-4444-555555555555',
      email: 'kid@example.com',
      screenName: 'CleverFox42',
      ageGroup: 'elementary',
      createdAt: '2026-01-01T00:00:00.000Z'
    }]
  })

  const response = await handler(makeEvent({ ageGroup: 'elementary' }))

  expect(response.statusCode).toBe(200)
  expect(JSON.parse(response.body).user.id).toBe('existing-user')
  expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0)
})
