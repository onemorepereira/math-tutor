import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { dynamodb } from './dynamodb.js'

const CACHE_TABLE = process.env.CACHE_TABLE || 'math-tutor-public-cache-dev'

// Cache TTL: 15 minutes
const CACHE_TTL_SECONDS = 15 * 60

export async function getCachedData(cacheKey: string): Promise<any | null> {
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: CACHE_TABLE,
      Key: { cacheKey }
    }))

    if (!result.Item) {
      return null
    }

    // Check if cache is still valid
    const now = Math.floor(Date.now() / 1000)
    if (result.Item.ttl && result.Item.ttl < now) {
      return null
    }

    return result.Item.data
  } catch (error) {
    console.error('Cache read error:', error)
    return null
  }
}

export async function setCachedData(cacheKey: string, data: any): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const ttl = now + CACHE_TTL_SECONDS

    await dynamodb.send(new PutCommand({
      TableName: CACHE_TABLE,
      Item: {
        cacheKey,
        data,
        ttl,
        updatedAt: new Date().toISOString()
      }
    }))
  } catch (error) {
    console.error('Cache write error:', error)
    // Don't throw - cache failures shouldn't break the app
  }
}
