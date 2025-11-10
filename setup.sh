#!/bin/bash

# Math Tutor - Quick Setup Script
# This script helps you set up the Math Tutor application quickly

set -e

echo "=================================="
echo "  Math Tutor - Quick Setup"
echo "=================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20.x or later."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version is too old. Please upgrade to Node.js 20.x or later."
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi
echo "✅ npm $(npm -v)"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI is not installed. You'll need it for deployment."
    echo "   Install from: https://aws.amazon.com/cli/"
else
    echo "✅ AWS CLI $(aws --version)"
fi

# Check SAM CLI
if ! command -v sam &> /dev/null; then
    echo "⚠️  AWS SAM CLI is not installed. You'll need it for deployment."
    echo "   Install from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
else
    echo "✅ AWS SAM CLI $(sam --version)"
fi

echo ""
echo "=================================="
echo "Installing dependencies..."
echo "=================================="

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

echo ""
echo "✅ All dependencies installed!"
echo ""

# Create .env file if it doesn't exist
if [ ! -f "frontend/.env" ]; then
    echo "Creating frontend/.env from template..."
    cp frontend/.env.example frontend/.env
    echo "⚠️  Please edit frontend/.env with your AWS configuration values"
    echo "   after deploying the backend with 'sam deploy --guided'"
fi

echo ""
echo "=================================="
echo "  Setup Complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Enable Amazon Bedrock Nova model access in AWS Console:"
echo "   - Go to Amazon Bedrock → Model access"
echo "   - Request access to Amazon Nova Lite"
echo ""
echo "2. Deploy the backend:"
echo "   $ sam build"
echo "   $ sam deploy --guided"
echo ""
echo "3. Configure frontend/.env with the outputs from SAM deploy"
echo ""
echo "4. Run the frontend development server:"
echo "   $ cd frontend"
echo "   $ npm run dev"
echo ""
echo "5. Open http://localhost:3000 in your browser"
echo ""
echo "For detailed instructions, see:"
echo "  - README.md (Overview and features)"
echo "  - DEPLOYMENT.md (Step-by-step deployment guide)"
echo "  - ARCHITECTURE.md (Technical architecture)"
echo ""
echo "Happy learning! 📚✨"
