# Math Tutor

An AI-powered math tutoring application built with AWS serverless technologies.

## Overview

Math Tutor is a full-stack serverless application that provides interactive math practice sessions for students. The application uses AI to generate personalized math problems and provides real-time feedback.

## Architecture

- **Frontend**: Vue 3 + TypeScript, hosted on S3 + CloudFront
- **Backend**: AWS Lambda + API Gateway (serverless)
- **Database**: DynamoDB
- **Authentication**: AWS Cognito
- **AI**: Amazon Bedrock (Claude 3.5 Sonnet)
- **Infrastructure**: AWS SAM + CloudFormation

## Features

- 🎯 AI-generated math problems tailored to difficulty level
- 📊 Real-time performance tracking and statistics
- 🏆 Leaderboard system
- 📈 Activity heatmaps and progress visualization
- 💯 Scoring system with hints
- 🎨 Responsive design for desktop and mobile

## Project Structure

```
math-tutor/
├── frontend/              # Vue.js frontend application
├── backend/              # AWS Lambda functions
├── docs/                 # Documentation
└── infrastructure/       # CloudFormation templates
```

## Documentation

- [Makefile Guide](docs/MAKEFILE-GUIDE.md) - Build and deployment commands

## Getting Started

### Prerequisites

- Node.js 18+
- AWS CLI configured
- AWS SAM CLI
- Docker (for local Lambda development)

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Backend Development

```bash
cd backend
npm install
npm run build
```

### Deployment

See the [Makefile Guide](docs/MAKEFILE-GUIDE.md) for detailed deployment instructions.

## Environments

- **Production**: https://app.example.com

## License

Private - All rights reserved
