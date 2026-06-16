/**
 * Error handler utility to sanitize errors and prevent leaking backend details
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
}

export interface SanitizedError {
  statusCode: number
  headers: typeof CORS_HEADERS
  body: string
}

/**
 * Sanitizes errors to prevent exposing backend implementation details
 * Logs full error details server-side but returns generic messages to clients
 */
export function sanitizeError(error: unknown, context: string): SanitizedError {
  // Log full error details server-side for debugging
  console.error(`[${context}] Error:`, {
    error,
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    type: error instanceof Error ? error.constructor.name : typeof error
  })

  // Determine appropriate status code and generic message
  let statusCode = 500
  let message = 'An error occurred processing your request'

  // Check for specific error types but don't expose details
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase()

    // Database/DynamoDB errors
    if (errorMessage.includes('dynamodb') || errorMessage.includes('table')) {
      statusCode = 500
      message = 'An error occurred processing your request'
    }
    // Bedrock/AI errors
    else if (errorMessage.includes('bedrock') || errorMessage.includes('model')) {
      statusCode = 500
      message = 'An error occurred generating content'
    }
    // Validation errors (safe to be more specific)
    else if (errorMessage.includes('required') || errorMessage.includes('invalid')) {
      statusCode = 400
      message = 'Invalid request data'
    }
    // Not found errors
    else if (errorMessage.includes('not found')) {
      statusCode = 404
      message = 'Resource not found'
    }
  }

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message })
  }
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(data: any, statusCode: number = 200) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data)
  }
}

/**
 * Creates a standardized error response with CORS headers
 */
export function createErrorResponse(statusCode: number, message: string) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message })
  }
}
