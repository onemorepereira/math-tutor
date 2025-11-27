# Number Ninja - System Architecture

## Overview

Number Ninja is a serverless, cloud-native math tutoring application built on AWS services. It uses Amazon Bedrock Nova for AI-powered math problem generation and intelligent tutoring.

## High-Level Architecture

```mermaid
flowchart TB
    subgraph User["User Layer"]
        Browser["Web Browser"]
    end

    subgraph Frontend["Frontend Layer"]
        Vue["Vue.js 3 SPA"]
        Pinia["Pinia Stores"]
        Router["Vue Router"]
        CognitoSDK["Cognito SDK"]
    end

    subgraph CDN["Content Delivery"]
        CloudFront["CloudFront CDN"]
        S3["S3 Bucket"]
    end

    subgraph Gateway["API Layer"]
        APIGW["API Gateway<br/>(REST API)"]
        Authorizer["Cognito Authorizer"]
        CORS["CORS Config"]
    end

    subgraph Lambda["Lambda Functions"]
        direction LR
        Register["RegisterUser"]
        Profile["GetProfile"]
        Session["CreateSession"]
        Hint["RequestHint"]
        Submit["SubmitAnswer"]
        EndGame["EndSession"]
        Explain["GetExplanation"]
        Leaderboard["Leaderboard"]
        Activity["Activity"]
    end

    subgraph Data["Data Layer"]
        Users[("Users Table")]
        Sessions[("Sessions Table")]
    end

    subgraph AI["AI Layer"]
        Bedrock["Amazon Bedrock<br/>Nova Lite"]
    end

    subgraph Auth["Authentication"]
        Cognito["Cognito User Pool"]
    end

    Browser --> CloudFront
    CloudFront --> S3
    Browser --> Vue
    Vue --> Pinia
    Vue --> Router
    Vue --> CognitoSDK
    CognitoSDK --> Cognito
    Vue --> APIGW
    APIGW --> Authorizer
    Authorizer --> Cognito
    APIGW --> Register & Profile & Session & Hint & Submit & EndGame & Explain & Leaderboard & Activity
    Register & Profile & Session & Submit & EndGame & Leaderboard & Activity --> Users
    Session & Submit & EndGame --> Sessions
    Session & Hint & Explain --> Bedrock
```

## Component Details

### Frontend Layer

**Technology**: Vue.js 3 with TypeScript, Vite build tool, Bangers font

**Key Components**:

```mermaid
graph TD
    App["App.vue<br/>(Shell + Header)"]

    subgraph Views
        Home["HomeView<br/>Landing + Difficulty"]
        Login["LoginView<br/>Authentication"]
        Register["RegisterView<br/>User Registration"]
        Game["GameView<br/>Problem Interface"]
        Scorecard["ScorecardView<br/>Results"]
        Stats["StatsView<br/>User Statistics"]
    end

    subgraph Components
        LB["Leaderboard<br/>Top 10 Ninjas"]
    end

    subgraph Stores
        AuthStore["authStore<br/>User State"]
        GameStore["gameStore<br/>Session State"]
    end

    subgraph Services
        AuthService["auth.ts<br/>Cognito Integration"]
        GameService["game.ts<br/>API Client"]
    end

    App --> Home & Login & Register & Game & Scorecard & Stats
    Home --> LB
    Game --> GameStore
    Login --> AuthStore
    AuthStore --> AuthService
    GameStore --> GameService
```

**State Management**:
- `authStore`: User authentication state, tokens, profile
- `gameStore`: Game session, current problem, timer, hints, score

### API Gateway Layer

**Endpoints**:

```mermaid
graph LR
    subgraph Public["Public Endpoints"]
        P1["POST /api/users/register"]
        P2["GET /api/public/leaderboard"]
        P3["GET /api/public/activity"]
    end

    subgraph Protected["Protected Endpoints"]
        A1["GET /api/users/profile"]
        A2["GET /api/users/sessions"]
        A3["POST /api/game/sessions"]
        A4["POST /api/game/sessions/{id}/problems/{id}/hints"]
        A5["POST /api/game/sessions/{id}/problems/{id}/submit"]
        A6["POST /api/game/sessions/{id}/end"]
        A7["GET /api/game/sessions/{id}/problems/{id}/explanation"]
    end

    APIGW["API Gateway"] --> Public
    APIGW --> Authorizer["Cognito Authorizer"]
    Authorizer --> Protected
```

### Lambda Functions

**Runtime**: Node.js 22.x with TypeScript

```mermaid
flowchart TB
    subgraph UserFunctions["User Management"]
        Register["RegisterUser<br/>Creates DynamoDB record<br/>Generates screen name"]
        Profile["GetUserProfile<br/>Retrieves user data"]
        Sessions["GetUserSessions<br/>Lists game history"]
    end

    subgraph GameFunctions["Game Operations"]
        Create["CreateGameSession<br/>Calls Bedrock<br/>Generates 10 problems"]
        Hint["RequestHint<br/>AI-powered hints<br/>-5 points per hint"]
        Submit["SubmitAnswer<br/>Validates answer<br/>Calculates points"]
        End["EndGameSession<br/>Updates stats<br/>Generates scorecard"]
        Explain["GetExplanation<br/>AI solution explanation"]
    end

    subgraph PublicFunctions["Public Data"]
        LB["GetLeaderboard<br/>Top 10 cached"]
        Act["GetActivity<br/>Heatmap data"]
    end
```

### Amazon Bedrock Integration

**Model**: Amazon Nova Lite (cost-effective, fast)

```mermaid
sequenceDiagram
    participant Lambda
    participant Bedrock as Bedrock Nova

    Note over Lambda,Bedrock: Problem Generation
    Lambda->>Bedrock: Generate 10 problems<br/>{difficulty, count}
    Bedrock-->>Lambda: JSON array with<br/>question, answer, topic, answerType

    Note over Lambda,Bedrock: Hint Generation
    Lambda->>Bedrock: Generate hint<br/>{question, answer, hintNum, ageGroup}
    Bedrock-->>Lambda: Progressive hint text

    Note over Lambda,Bedrock: Solution Explanation
    Lambda->>Bedrock: Explain solution<br/>{question, correctAnswer, userAnswer, ageGroup}
    Bedrock-->>Lambda: {explanation, steps, insight}
```

**Problem Types**:
- `answerType: "numeric"` - Numeric keypad on mobile
- `answerType: "text"` - Full keyboard for pattern/word answers

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Cognito
    participant Lambda
    participant DynamoDB

    Note over User,DynamoDB: Registration
    User->>Frontend: Submit registration form
    Frontend->>Cognito: signUp(email, password, ageGroup)
    Cognito-->>Frontend: User created
    Cognito->>User: Verification email
    User->>Frontend: Enter verification code
    Frontend->>Cognito: confirmSignUp(code)
    Cognito-->>Frontend: Confirmed
    Frontend->>Lambda: POST /register
    Lambda->>DynamoDB: Create user profile
    Lambda-->>Frontend: {userId, screenName}

    Note over User,DynamoDB: Login
    User->>Frontend: Enter credentials
    Frontend->>Cognito: signIn(email, password)
    Cognito-->>Frontend: JWT tokens (access, id, refresh)
    Frontend->>Frontend: Store tokens in memory

    Note over User,DynamoDB: API Access
    Frontend->>API: Request + Authorization header
    API->>Cognito: Validate JWT
    Cognito-->>API: Claims (sub, email, ageGroup)
    API->>Lambda: Invoke with claims
```

### Database Schema

```mermaid
erDiagram
    USERS {
        string userId PK "UUID"
        string cognitoId UK "Cognito sub"
        string email "User email"
        string screenName "Child-safe name"
        string ageGroup "elementary|middle|high"
        number gamesPlayed "Total games"
        number totalScore "Cumulative score"
        string createdAt "ISO timestamp"
    }

    GAME_SESSIONS {
        string sessionId PK "UUID"
        string odUserId FK "User reference"
        string difficulty "easy|medium|hard"
        list problems "10 problems array"
        list attempts "User attempts"
        number currentProblemIndex "0-9"
        number totalScore "Session score"
        number totalTimeSeconds "Total time"
        boolean isCompleted "Finished flag"
        string startTime "ISO timestamp"
        string endTime "ISO timestamp"
    }

    PROBLEMS {
        string question "Math question text"
        string answer "Correct answer"
        string topic "arithmetic|algebra|geometry"
        number maxPoints "5-20 based on difficulty"
        string answerType "numeric|text"
    }

    ATTEMPTS {
        number problemIndex "0-9"
        string userAnswer "User's answer"
        boolean isCorrect "Validation result"
        number pointsEarned "0 or maxPoints - hints"
        number hintsUsed "0-2"
        number timeSpentSeconds "Time on problem"
    }

    USERS ||--o{ GAME_SESSIONS : "plays"
    GAME_SESSIONS ||--|{ PROBLEMS : "contains"
    GAME_SESSIONS ||--|{ ATTEMPTS : "records"
```

**DynamoDB Indexes**:
- Users Table: GSI on `cognitoId` for fast lookup after login
- Sessions Table: GSI on `odUserId` for user session history

## Data Flows

### Starting a New Game

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Store as gameStore
    participant API
    participant Lambda
    participant Bedrock
    participant DDB as DynamoDB

    User->>Frontend: Click difficulty button
    Frontend->>Store: startNewGame(difficulty)
    Store->>API: POST /api/game/sessions
    API->>Lambda: CreateGameSession
    Lambda->>Bedrock: Generate 10 problems
    Note over Bedrock: Based on difficulty<br/>and variety rules
    Bedrock-->>Lambda: Problems JSON
    Lambda->>DDB: Insert session record
    DDB-->>Lambda: Success
    Lambda-->>API: {session, problems}
    API-->>Store: Response
    Store->>Store: Set currentProblem
    Store->>Frontend: Start timer
    Frontend->>User: Display first problem
```

### Submitting an Answer

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Store as gameStore
    participant API
    participant Lambda
    participant DDB as DynamoDB

    User->>Frontend: Type answer + Enter
    Frontend->>Store: submitAnswer(answer)
    Store->>API: POST /submit
    API->>Lambda: SubmitAnswer
    Lambda->>Lambda: Normalize & compare
    Note over Lambda: Case-insensitive<br/>Trim whitespace
    Lambda->>Lambda: Calculate points
    Note over Lambda: maxPoints - (hints × 5)<br/>0 if wrong
    Lambda->>DDB: Update session.attempts
    DDB-->>Lambda: Success
    Lambda-->>API: {isCorrect, points}
    API-->>Store: Response

    alt Correct Answer
        Store->>Frontend: Show success
        Frontend->>User: Green feedback
    else Wrong Answer
        Store->>Frontend: Show error
        Frontend->>User: Red feedback + correct answer
    end

    Store->>Store: Next problem or end
```

### Requesting a Hint

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Store as gameStore
    participant API
    participant Lambda
    participant Bedrock
    participant DDB as DynamoDB

    User->>Frontend: Click "Hint" button
    Frontend->>Store: requestHint()
    Note over Store: Check hints < 2
    Store->>API: POST /hints {hintNumber: 1 or 2}
    API->>Lambda: RequestHint
    Lambda->>DDB: Get session + problem
    Lambda->>Bedrock: Generate hint
    Note over Bedrock: Progressive hints:<br/>Hint 1 = subtle<br/>Hint 2 = stronger
    Bedrock-->>Lambda: Hint text
    Lambda-->>API: {hint, pointsDeducted: 5}
    API-->>Store: Response
    Store->>Store: hintsUsed++
    Store->>Frontend: Display hint
    Frontend->>User: Show hint card
```

## Security Architecture

```mermaid
flowchart TB
    subgraph Internet
        User["User Browser"]
    end

    subgraph AWS["AWS Cloud"]
        subgraph Edge["Edge Security"]
            WAF["WAF<br/>(Optional)"]
            CF["CloudFront"]
        end

        subgraph Network["API Security"]
            APIGW["API Gateway"]
            CORS["CORS Policy"]
            Throttle["Rate Limiting"]
        end

        subgraph Auth["Authentication"]
            Cognito["Cognito"]
            JWT["JWT Validation"]
        end

        subgraph Compute["Compute"]
            Lambda["Lambda"]
            IAM["IAM Roles"]
        end

        subgraph Data["Data"]
            DDB["DynamoDB"]
            Encrypt["Encryption at Rest"]
        end
    end

    User -->|HTTPS| WAF
    WAF --> CF
    User -->|HTTPS| APIGW
    APIGW --> CORS
    APIGW --> Throttle
    APIGW --> JWT
    JWT --> Cognito
    APIGW --> Lambda
    Lambda --> IAM
    IAM --> DDB
    DDB --> Encrypt
```

**Security Measures**:
- HTTPS/TLS 1.2+ for all communication
- JWT tokens with short expiration
- Cognito Authorizer on protected endpoints
- Lambda ownership verification (user can only access own data)
- IAM least-privilege policies
- DynamoDB encryption at rest
- CloudFront Origin Access Control (private S3)
- Content Security Policy headers
- HSTS headers

## Scalability

```mermaid
graph TB
    subgraph AutoScale["Auto-Scaling Components"]
        Lambda["Lambda<br/>1000+ concurrent"]
        DDB["DynamoDB<br/>On-demand capacity"]
        APIGW["API Gateway<br/>10K RPS default"]
        Cognito["Cognito<br/>Scales with users"]
    end

    subgraph Performance["Performance Optimizations"]
        NovaLite["Bedrock Nova Lite<br/>< 2s response"]
        GSI["DynamoDB GSIs<br/>Efficient queries"]
        Cache["TTL Caching<br/>Leaderboard/Activity"]
        Stateless["Stateless Lambda<br/>Parallel processing"]
    end
```

## Cost Optimization

```mermaid
pie title Monthly Cost Breakdown (100 games/day)
    "Lambda" : 1
    "DynamoDB" : 2
    "API Gateway" : 1
    "Bedrock" : 5
    "CloudFront" : 2
    "S3" : 0.5
```

**Pay-per-use Model**:
- Lambda: ~$1/month (free tier)
- DynamoDB: ~$2/month (on-demand)
- Bedrock Nova Lite: ~$5/month (cheapest model)
- API Gateway: ~$1/month
- CloudFront + S3: ~$2.50/month

**Total**: ~$10-15/month for moderate usage

## Monitoring & Observability

```mermaid
flowchart LR
    subgraph Sources["Log Sources"]
        Lambda["Lambda Logs"]
        APIGW["API Gateway Logs"]
        CF["CloudFront Logs"]
    end

    subgraph CloudWatch["CloudWatch"]
        Logs["Log Groups"]
        Metrics["Metrics"]
        Alarms["Alarms"]
    end

    subgraph Dashboards["Dashboards"]
        Errors["Error Rates"]
        Latency["Response Times"]
        Usage["Game Statistics"]
    end

    Lambda & APIGW & CF --> Logs
    Logs --> Metrics
    Metrics --> Alarms
    Metrics --> Dashboards
```

**Key Metrics**:
- API response times (p50, p95, p99)
- Lambda cold start frequency
- Bedrock response latency
- Error rates by endpoint
- Games played per day
- User engagement metrics

## Infrastructure as Code

All infrastructure defined in AWS SAM templates:

```
template.yaml                    # Backend (Lambda, API GW, DynamoDB, Cognito)
frontend-infrastructure.yaml     # Frontend (S3, CloudFront, WAF)
```

**Deployment Flow**:

```mermaid
flowchart LR
    Code["Code Changes"] --> Build["sam build"]
    Build --> Deploy["sam deploy"]
    Deploy --> CFN["CloudFormation"]
    CFN --> Stack["AWS Resources"]
    Stack --> Live["Production"]
```

## Future Enhancements

```mermaid
mindmap
  root((Number Ninja))
    Features
      Multiplayer
      Tournaments
      Achievement Badges
      Practice Mode
    Analytics
      QuickSight Dashboard
      Performance Trends
      Learning Insights
    Infrastructure
      ElastiCache
      WebSocket API
      EventBridge
    Mobile
      React Native App
      Push Notifications
```
