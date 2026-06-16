import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
export const dynamodb = DynamoDBDocumentClient.from(client)

export const USER_TABLE = process.env.USER_TABLE
if (!USER_TABLE) {
  throw new Error('USER_TABLE environment variable is not set')
}

export const GAME_SESSION_TABLE = process.env.GAME_SESSION_TABLE
if (!GAME_SESSION_TABLE) {
  throw new Error('GAME_SESSION_TABLE environment variable is not set')
}
