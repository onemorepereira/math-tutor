// Test environment variables required at module load by utils/dynamodb.ts
process.env.USER_TABLE = 'TestUsers'
process.env.GAME_SESSION_TABLE = 'TestSessions'
process.env.CACHE_TABLE = 'TestCache'
