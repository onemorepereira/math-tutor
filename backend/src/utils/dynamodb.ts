import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  paginateQuery,
  paginateScan,
  type QueryCommandInput,
  type ScanCommandInput
} from '@aws-sdk/lib-dynamodb'

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

// A single Query or Scan stops at 1 MB of data read (before any filter), so
// anything that must see every item has to follow LastEvaluatedKey
export async function queryAll(input: QueryCommandInput): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = []
  for await (const page of paginateQuery({ client: dynamodb }, input)) {
    items.push(...(page.Items ?? []))
  }
  return items
}

export async function scanAll(input: ScanCommandInput): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = []
  for await (const page of paginateScan({ client: dynamodb }, input)) {
    items.push(...(page.Items ?? []))
  }
  return items
}
