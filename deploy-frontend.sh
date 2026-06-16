#!/bin/bash

# Math Tutor Frontend Deployment Script
# Builds the Vue app and deploys to S3 + CloudFront

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values (prod is the only active environment)
ENVIRONMENT=${1:-prod}
STACK_NAME="math-tutor-frontend-${ENVIRONMENT}"
BACKEND_STACK_NAME="math-tutor-${ENVIRONMENT}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Math Tutor Frontend Deployment${NC}"
echo -e "${GREEN}Environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}========================================${NC}"

# Step 1: Get the API URL from backend stack
echo -e "\n${YELLOW}Step 1: Getting API URL from backend stack...${NC}"
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$BACKEND_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
  echo -e "${RED}Error: Could not find backend API URL${NC}"
  echo -e "${YELLOW}Make sure your backend stack is deployed first${NC}"
  exit 1
fi

echo -e "${GREEN}API URL: ${API_URL}${NC}"

# Step 2: Check if frontend infrastructure stack exists
echo -e "\n${YELLOW}Step 2: Checking frontend infrastructure...${NC}"
STACK_EXISTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].StackStatus" \
  --output text 2>/dev/null || echo "")

if [ -z "$STACK_EXISTS" ]; then
  echo -e "${YELLOW}Infrastructure stack does not exist. Creating...${NC}"
  aws cloudformation create-stack \
    --stack-name "$STACK_NAME" \
    --template-body file://frontend-infrastructure.yaml \
    --parameters ParameterKey=Environment,ParameterValue=$ENVIRONMENT \
    --capabilities CAPABILITY_IAM

  echo -e "${YELLOW}Waiting for stack creation to complete...${NC}"
  aws cloudformation wait stack-create-complete --stack-name "$STACK_NAME"
  echo -e "${GREEN}Infrastructure stack created successfully!${NC}"
else
  echo -e "${GREEN}Infrastructure stack exists: ${STACK_EXISTS}${NC}"
fi

# Step 3: Get bucket name and CloudFront distribution ID
echo -e "\n${YELLOW}Step 3: Getting deployment targets...${NC}"
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
  --output text)

echo -e "${GREEN}S3 Bucket: ${BUCKET_NAME}${NC}"
echo -e "${GREEN}CloudFront Distribution: ${DISTRIBUTION_ID}${NC}"
echo -e "${GREEN}CloudFront URL: ${CLOUDFRONT_URL}${NC}"

# Step 4: Build the frontend
echo -e "\n${YELLOW}Step 4: Building frontend...${NC}"
cd frontend

# Get Cognito credentials from backend stack
echo -e "${YELLOW}Getting Cognito credentials...${NC}"
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$BACKEND_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$BACKEND_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)

# Create/update .env.production with all environment variables
cat > .env.production << EOF
# API Configuration
VITE_API_URL=${API_URL}

# AWS Cognito Configuration
VITE_COGNITO_USER_POOL_ID=${USER_POOL_ID}
VITE_COGNITO_CLIENT_ID=${CLIENT_ID}
EOF

echo -e "${GREEN}Created .env.production with all credentials${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
fi

# Build the app (npm run build runs vue-tsc type-check before vite build)
echo -e "${YELLOW}Building Vue app...${NC}"
npm run build

if [ ! -d "dist" ]; then
  echo -e "${RED}Error: Build failed - dist directory not found${NC}"
  exit 1
fi

echo -e "${GREEN}Build completed successfully!${NC}"

# Step 5: Upload to S3
echo -e "\n${YELLOW}Step 5: Uploading to S3...${NC}"

# Upload with appropriate cache headers
# HTML files: no cache (always check for updates)
aws s3 sync dist/ s3://${BUCKET_NAME}/ \
  --exclude "*" \
  --include "*.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata-directive REPLACE \
  --delete

# CSS and JS files: cache for 1 year (they have content hashes in names)
aws s3 sync dist/ s3://${BUCKET_NAME}/ \
  --exclude "*.html" \
  --cache-control "public, max-age=31536000, immutable" \
  --metadata-directive REPLACE \
  --delete

echo -e "${GREEN}Upload completed!${NC}"

# Step 6: Invalidate CloudFront cache
echo -e "\n${YELLOW}Step 6: Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text)

echo -e "${GREEN}Invalidation created: ${INVALIDATION_ID}${NC}"
echo -e "${YELLOW}Waiting for invalidation to complete (this may take a few minutes)...${NC}"

aws cloudfront wait invalidation-completed \
  --distribution-id ${DISTRIBUTION_ID} \
  --id ${INVALIDATION_ID}

echo -e "${GREEN}Invalidation completed!${NC}"

# Step 7: Done!
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Successful! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${GREEN}Your application is now live at:${NC}"
echo -e "${GREEN}https://${CLOUDFRONT_URL}${NC}"
echo -e "\n${YELLOW}Note: It may take 1-2 minutes for all edge locations to update${NC}"

cd ..
