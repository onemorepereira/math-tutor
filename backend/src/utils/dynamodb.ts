import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
export const dynamodb = DynamoDBDocumentClient.from(client)

export const USER_TABLE = process.env.USER_TABLE || ''
export const GAME_SESSION_TABLE = process.env.GAME_SESSION_TABLE || ''
