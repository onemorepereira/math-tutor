# Math Tutor - System Architecture

## Overview

The Math Tutor application is a serverless, cloud-native solution built on AWS services. It uses Amazon Bedrock Nova for AI-powered math problem generation and tutoring.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          User (Browser)                         │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTPS
             │
┌────────────▼────────────────────────────────────────────────────┐
│                   Vue.js Frontend (SPA)                         │
│  - Vue 3 + TypeScript                                           │
│  - Pinia State Management                                       │
│  - Vue Router                                                   │
│  - Cognito Identity SDK                                         │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ REST API (HTTPS)
             │
┌────────────▼────────────────────────────────────────────────────┐
│               Amazon API Gateway (REST API)                     │
│  - CORS Configuration                                           │
│  - Cognito Authorizer                                          │
│  - Request/Response Mapping                                    │
└──────┬──────┬──────┬──────┬──────┬──────┬────────────────────────┘
       │      │      │      │      │      │
       │      │      │      │      │      │
       ▼      ▼      ▼      ▼      ▼      ▼
┌──────────────────────────────────────────────────────────────────┐
│                      AWS Lambda Functions                        │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │    Register    │  │  Get Profile   │  │  Create Session  │  │
│  │     User       │  │                │  │                  │  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │  Request Hint  │  │ Submit Answer  │  │   End Session    │  │
│  │                │  │                │  │                  │  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
│                                                                  │
│  ┌────────────────┐                                             │
│  │ Get Explanation│                                             │
│  │                │                                             │
│  └────────────────┘                                             │
└──────┬──────────┬─────────────────────────────────┬────────────┘
       │          │                                 │
       │          │                                 │
       ▼          ▼                                 ▼
┌─────────────────────┐                   ┌──────────────────────┐
│  Amazon Cognito     │                   │  Amazon Bedrock      │
│   User Pools        │                   │    Nova Lite         │
│                     │                   │                      │
│  - User Management  │                   │ - Problem Generation │
│  - Authentication   │                   │ - Hint Generation    │
│  - Email Verification│                  │ - Explanations       │
└─────────────────────┘                   └──────────────────────┘

       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Amazon DynamoDB                          │
│                                                                 │
│  ┌─────────────────────────┐    ┌──────────────────────────┐  │
│  │      Users Table        │    │   Game Sessions Table    │  │
│  │                         │    │                          │  │
│  │  - userId (PK)          │    │  - sessionId (PK)        │  │
│  │  - cognitoId (GSI)      │    │  - userId (GSI)          │  │
│  │  - email                │    │  - problems              │  │
│  │  - screenName           │    │  - attempts              │  │
│  │  - ageGroup             │    │  - totalScore            │  │
│  │  - stats                │    │  - totalTime             │  │
│  └─────────────────────────┘    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend Layer

**Technology**: Vue.js 3 with TypeScript, Vite build tool

**Key Components**:
- `HomeView.vue`: Landing page and difficulty selection
- `RegisterView.vue`: User registration form
- `LoginView.vue`: User authentication
- `GameView.vue`: Main game interface with problem display, timer, hints
- `ScorecardView.vue`: Results and wrong answer review

**State Management**:
- `authStore`: User authentication state
- `gameStore`: Game session, current problem, timer, hints

**Services**:
- `auth.ts`: Cognito integration for registration/login
- `game.ts`: API calls to backend for game operations

### API Gateway Layer

**Configuration**:
- REST API with multiple endpoints
- CORS enabled for browser access
- Cognito User Pool Authorizer for protected endpoints
- Request/response transformation

**Endpoints**:
```
POST   /api/users/register             (Public)
GET    /api/users/profile              (Authenticated)
POST   /api/game/sessions              (Authenticated)
POST   /api/game/sessions/{id}/problems/{id}/hints     (Authenticated)
POST   /api/game/sessions/{id}/problems/{id}/submit    (Authenticated)
POST   /api/game/sessions/{id}/end     (Authenticated)
GET    /api/game/sessions/{id}/problems/{id}/explanation (Authenticated)
```

### Lambda Functions Layer

**Runtime**: Node.js 20.x with TypeScript

**Functions**:

1. **RegisterUser**
   - Creates user record in DynamoDB
   - Generates child-friendly screen name
   - Links Cognito ID to user profile

2. **GetUserProfile**
   - Retrieves user data from DynamoDB
   - Uses Cognito ID from JWT token

3. **CreateGameSession**
   - Calls Bedrock to generate 10 math problems
   - Creates session record in DynamoDB
   - Returns session with problems to frontend

4. **RequestHint**
   - Calls Bedrock to generate contextual hint
   - Uses problem and user age group for personalization
   - Returns hint without storing (stateless)

5. **SubmitAnswer**
   - Validates answer against correct answer
   - Calculates points (max points - hint deductions)
   - Updates session with attempt record
   - Returns immediate feedback

6. **EndGameSession**
   - Calculates final scorecard statistics
   - Marks session as completed
   - Updates user stats (games played, total score)

7. **GetSolutionExplanation**
   - Calls Bedrock for age-appropriate explanation
   - Includes step-by-step solution
   - Provides learning insights

### Amazon Bedrock Layer

**Model**: Amazon Nova Lite (cost-effective, fast)

**Use Cases**:

1. **Problem Generation**
   - Input: Difficulty level, problem count
   - Output: JSON array of problems with questions, answers, topics
   - Prompt: Structured to ensure variety and age-appropriateness

2. **Hint Generation**
   - Input: Question, correct answer, hint number (1 or 2), age group
   - Output: Text hint (progressively stronger)
   - Prompt: Guides without revealing answer

3. **Solution Explanation**
   - Input: Question, correct answer, user's answer, age group
   - Output: JSON with explanation, steps, and insight
   - Prompt: Educational, encouraging, age-appropriate

### Authentication Layer

**Service**: Amazon Cognito User Pools

**Features**:
- Email-based registration
- Secure password authentication (8+ chars, uppercase, lowercase, numbers)
- JWT token generation
- Custom attributes (ageGroup)
- Integration with API Gateway authorizer

**Flow**:
1. User registers → Cognito creates user → Backend creates profile
2. User logs in → Cognito returns JWT tokens
3. Frontend stores tokens → Includes in API requests
4. API Gateway validates JWT → Extracts user claims → Passes to Lambda

### Database Layer

**Service**: Amazon DynamoDB (NoSQL)

**Tables**:

**Users Table**:
```
Primary Key: userId (String)
GSI: cognitoId → userId
Attributes:
  - email (String)
  - screenName (String) - randomly generated
  - ageGroup (String) - elementary/middle/high
  - createdAt (String ISO timestamp)
  - gamesPlayed (Number)
  - totalScore (Number)
```

**Game Sessions Table**:
```
Primary Key: sessionId (String)
GSI: userId → sessionId
Attributes:
  - userId (String)
  - startTime (String ISO timestamp)
  - endTime (String ISO timestamp)
  - difficulty (String)
  - problems (List of Maps) - 10 problems with questions, answers, topics
  - attempts (List of Maps) - user's attempts with answers, time, points
  - currentProblemIndex (Number)
  - totalScore (Number)
  - totalTimeSeconds (Number)
  - isCompleted (Boolean)
```

## Data Flow

### Starting a New Game

```
User clicks difficulty
    ↓
Frontend: gameStore.startNewGame(difficulty)
    ↓
POST /api/game/sessions { difficulty }
    ↓
Lambda: CreateGameSession
    ↓
Bedrock Nova: Generate 10 problems
    ↓
DynamoDB: Insert session record
    ↓
Response: { session with problems }
    ↓
Frontend: Display first problem, start timer
```

### Requesting a Hint

```
User clicks "Request Hint"
    ↓
Frontend: gameStore.requestHint()
    ↓
POST /api/game/sessions/{id}/problems/{id}/hints
    ↓
Lambda: RequestHint
    ↓
DynamoDB: Fetch session and problem
    ↓
Bedrock Nova: Generate hint based on problem
    ↓
Response: { hint content, point deduction }
    ↓
Frontend: Display hint, track hints used
```

### Submitting an Answer

```
User submits answer
    ↓
Frontend: gameStore.submitAnswer(answer)
    ↓
POST /api/game/sessions/{id}/problems/{id}/submit
    ↓
Lambda: SubmitAnswer
    ↓
Compare answer with correct answer
    ↓
Calculate points (maxPoints - hints*5)
    ↓
DynamoDB: Update session with attempt
    ↓
Response: { isCorrect, pointsEarned }
    ↓
Frontend: Show feedback, load next problem
```

## Security

### Authentication & Authorization
- Cognito User Pools for identity management
- JWT tokens for API authentication
- API Gateway Cognito Authorizer validates all requests
- Lambda functions verify user ownership of resources

### Data Protection
- HTTPS/TLS for all communication
- Environment variables for sensitive configuration
- IAM roles with least-privilege permissions
- No sensitive data in frontend code

### API Security
- CORS configured for specific origins
- Rate limiting via API Gateway
- Input validation in Lambda functions
- Parameterized DynamoDB queries (no injection risks)

## Scalability

### Automatic Scaling
- **Lambda**: Scales to thousands of concurrent executions
- **DynamoDB**: On-demand capacity scales automatically
- **API Gateway**: Handles millions of requests
- **Cognito**: Scales with user base

### Performance Optimizations
- Bedrock Nova Lite for fast AI responses (< 2s typically)
- DynamoDB GSI for efficient user lookups
- Frontend state management reduces API calls
- Stateless Lambda functions for parallel processing

## Cost Optimization

### Pay-per-use Model
- Lambda: Only pay for execution time
- DynamoDB: On-demand pricing (no idle costs)
- Bedrock: Pay per token (very low cost)
- API Gateway: Pay per request

### Efficiency Measures
- Use smallest sufficient Lambda memory (512MB)
- Bedrock Nova Lite (cheapest model)
- Efficient DynamoDB queries with GSIs
- Frontend caching of user data

## Monitoring & Observability

### AWS CloudWatch
- Lambda function logs and metrics
- API Gateway access logs
- DynamoDB metrics (latency, throttles)
- Custom metrics for game statistics

### Key Metrics
- API response times
- Lambda cold start frequency
- Bedrock response latency
- Error rates by endpoint
- User engagement (games per user, completion rate)

## Disaster Recovery

### Data Durability
- DynamoDB: 99.999999999% durability (11 9's)
- Multi-AZ replication automatic
- Point-in-time recovery available
- On-demand backups

### High Availability
- Lambda: Multi-AZ by default
- API Gateway: Multi-AZ by default
- DynamoDB: Multi-AZ replication
- Cognito: Multi-AZ by default

## Future Architecture Enhancements

1. **Caching Layer**: Add ElastiCache for frequently accessed data
2. **Analytics**: Add Amazon QuickSight for insights dashboard
3. **Real-time Features**: Use WebSockets (API Gateway WebSocket API) for multiplayer
4. **Content Delivery**: CloudFront CDN for frontend assets
5. **Event-Driven**: EventBridge for async workflows (notifications, analytics)
6. **Advanced AI**: Use Claude models for more sophisticated tutoring

## Infrastructure as Code

All infrastructure is defined in `template.yaml` using AWS SAM:
- Declarative configuration
- Version controlled
- Repeatable deployments
- Easy rollbacks
- Parameter-based environments (dev/prod)

## Development Workflow

```
Local Development
    ↓
git commit & push
    ↓
sam build
    ↓
sam deploy --guided (first time)
    ↓
CloudFormation creates/updates stack
    ↓
Deployed to AWS
    ↓
Frontend build & deploy
    ↓
Production Ready
```
