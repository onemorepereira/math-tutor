# Math Tutor - Quick Reference Card

## Documentation Index

| Document | Description |
|----------|-------------|
| [README.md](README.md) | Main project overview, features, quick start |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Detailed step-by-step deployment guide |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture and design |
| [FRONTEND-HOSTING.md](FRONTEND-HOSTING.md) | Frontend S3+CloudFront hosting details |
| [SIGNUP-CONTROL.md](SIGNUP-CONTROL.md) | User signup enable/disable feature |
| [frontend/MAKEFILE-GUIDE.md](frontend/MAKEFILE-GUIDE.md) | Frontend Makefile reference |
| [CLEANUP.md](CLEANUP.md) | Infrastructure destruction guide |
| [QUICK-REFERENCE.md](QUICK-REFERENCE.md) | This file - quick command reference |

## Essential Commands

### Backend

```bash
# Build and deploy
make deploy

# Check status
make status

# View outputs
make outputs

# Control signups
make disable-signups
make enable-signups
make check-signups

# View logs
make logs

# Destroy
make destroy
```

### Frontend

```bash
cd frontend

# Full deployment
make deploy

# Quick deployment (code changes only)
make quick-deploy

# Local development
make dev

# Check status
make outputs

# Update infrastructure only
make update-infrastructure

# Destroy
make destroy
```

## Quick Start (First Time)

```bash
# 1. Enable Bedrock Nova Lite in AWS Console

# 2. Deploy backend
make deploy

# 3. Deploy frontend
cd frontend
make deploy

# Done! Your app is live
```

## Directory Structure

```
math-tutor/
├── frontend/                # Vue 3 + TypeScript frontend
│   ├── src/
│   ├── Makefile            # Frontend deployment
│   └── package.json
├── backend/                 # Node.js 22 Lambda functions
│   ├── src/
│   ├── Makefile            # Build targets
│   └── package.json
├── Makefile                 # Backend operations
├── template.yaml            # SAM template (backend)
├── frontend-infrastructure.yaml  # CloudFormation (frontend)
└── *.md                     # Documentation
```

## Tech Stack

### Frontend
- Vue 3 + Composition API
- TypeScript
- Vite
- Pinia (state management)
- S3 + CloudFront hosting

### Backend
- Node.js 22.x
- AWS Lambda
- API Gateway
- DynamoDB
- Amazon Bedrock (Nova Lite)
- AWS Cognito

## Key Features

- AI-generated math problems (Bedrock Nova)
- Intelligent hints system
- Age-appropriate explanations
- Public leaderboard
- Activity heatmap
- User authentication
- Signup control
- Anonymous screen names

## API Endpoints

### Public
- `GET /api/public/leaderboard` - Global leaderboard
- `GET /api/public/activity` - Activity stats
- `POST /api/users/register` - Register new user

### Authenticated
- `GET /api/users/profile` - User profile
- `GET /api/users/sessions` - User's game sessions
- `POST /api/game/sessions` - Create game session
- `POST /api/game/sessions/{id}/problems/{id}/hints` - Request hint
- `POST /api/game/sessions/{id}/problems/{id}/submit` - Submit answer
- `POST /api/game/sessions/{id}/end` - End game session
- `GET /api/game/sessions/{id}/problems/{id}/explanation` - Get explanation

## Environments

### Development
- Stack names: `math-tutor-dev`, `math-tutor-frontend-dev`
- Parameter: `Environment=dev`

### Production
- Stack names: `math-tutor-prod`, `math-tutor-frontend-prod`
- Parameter: `Environment=prod`

Change environment:
```bash
# Backend
make deploy ENV=prod

# Frontend
cd frontend
make deploy ENV=prod
```

## Cost Estimates

| Service | Monthly Cost (100 games/day) |
|---------|------------------------------|
| Lambda | ~$1 |
| DynamoDB | ~$1-2 |
| API Gateway | ~$1 |
| Bedrock (Nova Lite) | ~$2-5 |
| S3 | <$1 |
| CloudFront | ~$1-3 |
| Cognito | Free (< 50K MAU) |
| **Total** | **~$5-15/month** |

## Security Features

- HTTPS only (TLS 1.2+)
- Content Security Policy
- HSTS headers
- XSS Protection
- Private S3 bucket (OAC)
- Cognito authentication
- Input validation
- Rate limiting

## Troubleshooting

### Backend not deploying
```bash
# Check Bedrock access
aws bedrock list-foundation-models --region us-east-1

# Check SAM installation
sam --version

# View stack events
aws cloudformation describe-stack-events --stack-name math-tutor-dev
```

### Frontend not updating
```bash
# Check invalidation status
cd frontend
make check-invalidation

# Hard refresh browser
# Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

### CORS errors
```bash
# Verify API URL matches
cd frontend
cat .env.production

# Check backend CORS (in template.yaml)
# Redeploy backend if changed
make deploy
```

## Common Workflows

### Daily Development

```bash
# Backend changes
make deploy

# Frontend changes
cd frontend
make quick-deploy
```

### New Feature Deployment

```bash
# 1. Backend
make deploy

# 2. Frontend
cd frontend
make deploy
```

### View Current Deployment

```bash
# Backend info
make outputs

# Frontend info
cd frontend
make outputs
```

### Disable Signups for Beta

```bash
make disable-signups
```

### Export Data Before Cleanup

```bash
# Export users
aws dynamodb scan --table-name math-tutor-users-dev > users-backup.json

# Export sessions
aws dynamodb scan --table-name math-tutor-sessions-dev > sessions-backup.json
```

### Clean Destroy

```bash
# 1. Frontend first
cd frontend
make destroy

# 2. Then backend
cd ..
make destroy
```

## Getting Help

- **Documentation**: Check the docs listed at the top
- **Stack events**: `aws cloudformation describe-stack-events --stack-name <stack>`
- **Lambda logs**: `make logs` or `sam logs -n <FunctionName> --tail`
- **CloudWatch**: AWS Console → CloudWatch → Log Groups
- **Issues**: Open an issue on GitHub

## Version Info

- **Runtime**: Node.js 22.x
- **Frontend Framework**: Vue 3
- **Infrastructure**: AWS SAM / CloudFormation
- **AI Model**: Amazon Bedrock Nova Lite

## Author

Miguel Pereira
Copyright © 2025

---

**Quick Access**: For detailed information on any topic, see the document index at the top of this file.
