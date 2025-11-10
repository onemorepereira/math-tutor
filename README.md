# Math Tutor - AI-Powered Math Learning Game

An interactive, web-based math tutoring application powered by Amazon Bedrock Nova models. Students solve math problems, receive intelligent hints, and get age-appropriate explanations.

## Features

- **AI-Generated Problems**: Amazon Bedrock Nova dynamically generates math problems tailored to difficulty levels
- **Intelligent Hints**: Up to 2 hints per problem (5 points deducted per hint)
- **Time Tracking**: Records time spent on each problem
- **Adaptive Difficulty**: Supports Elementary, Middle School, and High School levels
- **Detailed Scorecard**: Review performance and learn from mistakes
- **Age-Appropriate Explanations**: AI-generated solution explanations matched to student age
- **Anonymous Identity**: Child-friendly randomly generated screen names
- **User Authentication**: Secure email-based registration via AWS Cognito
- **Public Leaderboard**: Global leaderboard and activity heatmap
- **Signup Control**: Ability to enable/disable new user signups

## Architecture

### Frontend
- **Framework**: Vue.js 3 with TypeScript and Composition API
- **Build Tool**: Vite
- **State Management**: Pinia
- **Authentication**: Amazon Cognito Identity SDK
- **Hosting**: Amazon S3 + CloudFront
- **Deployment**: Automated via Makefile

### Backend
- **Runtime**: AWS Lambda (Node.js 22.x)
- **API**: Amazon API Gateway with Cognito Authorizer
- **Database**: Amazon DynamoDB (Pay-per-request)
- **AI/ML**: Amazon Bedrock Nova Lite
- **Authentication**: Amazon Cognito User Pools
- **Infrastructure**: AWS SAM (Serverless Application Model)
- **Cache**: DynamoDB TTL for public stats caching

## Project Structure

```
math-tutor/
├── frontend/                      # Vue.js frontend application
│   ├── src/
│   │   ├── components/           # Vue components
│   │   ├── views/                # Page views
│   │   ├── stores/               # Pinia state stores
│   │   ├── services/             # API service layer
│   │   ├── types/                # TypeScript types
│   │   └── router/               # Vue Router configuration
│   ├── Makefile                  # Frontend deployment automation
│   └── package.json
├── backend/                       # Lambda functions
│   ├── src/
│   │   ├── functions/            # Lambda handlers
│   │   └── utils/                # Shared utilities
│   ├── Makefile                  # Backend build targets
│   └── package.json
├── Makefile                       # Root Makefile (backend operations)
├── template.yaml                  # AWS SAM template (backend)
├── frontend-infrastructure.yaml   # CloudFormation template (frontend)
└── Documentation/
    ├── README.md                  # This file
    ├── DEPLOYMENT.md              # Detailed deployment guide
    ├── ARCHITECTURE.md            # Architecture details
    ├── FRONTEND-HOSTING.md        # Frontend hosting guide
    ├── SIGNUP-CONTROL.md          # Signup control feature
    └── frontend/MAKEFILE-GUIDE.md # Frontend Makefile reference
```

## Quick Start

### Prerequisites
- Node.js 22.x or later
- AWS Account with:
  - Amazon Bedrock access (Nova Lite model enabled)
  - AWS SAM CLI installed
  - AWS CLI configured with credentials
- npm package manager

### 1. Enable Amazon Bedrock
1. Go to AWS Console → Amazon Bedrock
2. Navigate to "Model access"
3. Request access to "Amazon Nova Lite" model
4. Wait for approval (usually instant)

### 2. Deploy Backend

```bash
# From project root
make deploy

# Or manually:
sam build && sam deploy --guided
```

Save the output values: `ApiUrl`, `UserPoolId`, `UserPoolClientId`

### 3. Deploy Frontend

```bash
cd frontend
make deploy
```

The frontend Makefile will:
- Automatically fetch backend configuration
- Build the Vue.js app
- Deploy CloudFormation infrastructure (S3 + CloudFront)
- Upload files
- Invalidate CloudFront cache

Your application is now live at the CloudFront URL shown in the output!

## Development Workflow

### Backend Development

```bash
# Build backend
make build

# Deploy changes
make deploy

# Check status
make status

# View outputs
make outputs

# Check signup status
make check-signups
```

### Frontend Development

```bash
cd frontend

# Local development
make dev

# Quick deployment (code changes only)
make quick-deploy

# Full deployment (infrastructure + code)
make deploy

# Check deployment info
make outputs
```

## Key Features & Documentation

### Signup Control
Control new user registrations with a single command:

```bash
# Disable new signups
make disable-signups

# Enable new signups
make enable-signups

# Check current status
make check-signups
```

See [SIGNUP-CONTROL.md](SIGNUP-CONTROL.md) for details.

### Frontend Deployment
Frontend is hosted on S3 + CloudFront with:
- HTTPS enforcement
- Security headers (CSP, HSTS, XSS Protection)
- SPA routing support
- Aggressive caching for assets
- Cost-optimized (PriceClass_100)

See [FRONTEND-HOSTING.md](FRONTEND-HOSTING.md) and [frontend/MAKEFILE-GUIDE.md](frontend/MAKEFILE-GUIDE.md) for details.

### Architecture
Detailed architecture documentation including:
- System design
- Data flow
- Security model
- API design

See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

## Game Mechanics

### Scoring System
- Each problem: 5-20 points (based on difficulty)
- Each hint: -5 points from potential score
- Wrong answers: 0 points
- Time tracked but doesn't affect score

### Difficulty Levels

**Elementary (Ages 6-10)**
- Basic arithmetic (addition, subtraction)
- Simple multiplication and division
- Number patterns

**Middle School (Ages 11-14)**
- Fractions and decimals
- Percentages
- Pre-algebra
- Basic geometry

**High School (Ages 15-18)**
- Algebra and equations
- Geometry and trigonometry
- Advanced problem solving

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users/register` | No | Register new user |
| GET | `/api/users/profile` | Yes | Get user profile |
| GET | `/api/users/sessions` | Yes | Get user's game sessions |
| POST | `/api/game/sessions` | Yes | Create new game session |
| POST | `/api/game/sessions/{id}/problems/{id}/hints` | Yes | Request hint |
| POST | `/api/game/sessions/{id}/problems/{id}/submit` | Yes | Submit answer |
| POST | `/api/game/sessions/{id}/end` | Yes | End game session |
| GET | `/api/game/sessions/{id}/problems/{id}/explanation` | Yes | Get solution explanation |
| GET | `/api/public/leaderboard` | No | Get public leaderboard |
| GET | `/api/public/activity` | No | Get activity stats |

## Cost Estimation

### AWS Services
- **Lambda**: Pay per request (generous free tier)
- **DynamoDB**: On-demand pricing (free tier available)
- **API Gateway**: Pay per API call
- **Cognito**: Free for up to 50,000 MAUs
- **Bedrock Nova Lite**: ~$0.00006 per 1K input tokens, ~$0.00024 per 1K output tokens
- **S3**: Minimal storage costs
- **CloudFront**: PriceClass_100 (cheapest option)

**Estimated Cost**: For moderate usage (100 games/day), expect ~$5-15/month

## Security Features

- HTTPS only (TLS 1.2+)
- Content Security Policy (CSP)
- Strict Transport Security (HSTS)
- XSS Protection headers
- Private S3 bucket (Origin Access Control)
- Cognito authentication for protected endpoints
- Input validation on all API endpoints
- Rate limiting via API Gateway

## Monitoring

### CloudWatch Logs
```bash
# Backend
make logs

# View specific function
sam logs -n CreateGameSessionFunction --tail
```

### CloudFront Status
```bash
cd frontend
make logs
```

### Check Infrastructure Status
```bash
# Backend
make status

# Frontend
cd frontend && make status
```

## Cleanup / Destruction

To completely remove all infrastructure:

```bash
# Destroy frontend (S3 + CloudFront)
cd frontend
make destroy

# Destroy backend (Lambda, API Gateway, DynamoDB, Cognito)
cd ..
make destroy
```

**Warning**: This permanently deletes all data and cannot be undone!

See [CLEANUP.md](CLEANUP.md) for detailed cleanup instructions.

## Troubleshooting

### Bedrock Access Denied
- Ensure Nova Lite model access is enabled in Bedrock console
- Verify Lambda execution role has `bedrock:InvokeModel` permission

### CORS Errors
- Check that API URL in frontend matches deployed API Gateway URL
- Verify CORS headers are properly configured

### Cognito Authentication Fails
- Verify User Pool ID and Client ID are correct
- Check email verification settings

### Frontend Not Updating
- CloudFront cache may need 1-2 minutes to invalidate
- Hard refresh browser (Ctrl+Shift+R)
- Check invalidation status: `cd frontend && make check-invalidation`

## Future Enhancements

- [ ] Progress tracking and historical performance analytics
- [ ] Multiplayer competitions and tournaments
- [ ] Additional subject areas (science, vocabulary)
- [ ] Parent/teacher dashboard
- [ ] Custom problem sets
- [ ] Achievement badges and rewards
- [ ] Mobile app (React Native)

## Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [FRONTEND-HOSTING.md](FRONTEND-HOSTING.md) - Frontend hosting details
- [SIGNUP-CONTROL.md](SIGNUP-CONTROL.md) - Signup control feature
- [frontend/MAKEFILE-GUIDE.md](frontend/MAKEFILE-GUIDE.md) - Frontend Makefile reference
- [CLEANUP.md](CLEANUP.md) - Infrastructure cleanup guide

## License

MIT License - See LICENSE file for details

## Author

**Miguel Pereira**

Copyright © 2025 Miguel Pereira. All rights reserved.

## Support

For issues and questions, please open an issue on GitHub.
