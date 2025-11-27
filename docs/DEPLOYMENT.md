# Deployment Guide

This guide walks you through deploying the Math Tutor application to AWS.

## Prerequisites Checklist

- [ ] AWS Account with admin access or appropriate IAM permissions
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] AWS SAM CLI installed ([Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- [ ] Node.js 22.x or later installed
- [ ] Amazon Bedrock access enabled in your AWS region
- [ ] `make` command available (pre-installed on macOS/Linux)

## Step 1: Enable Amazon Bedrock

Amazon Bedrock requires you to request model access before use:

1. Sign in to AWS Console
2. Navigate to **Amazon Bedrock** service
3. In the left sidebar, click **Model access**
4. Click **Manage model access** or **Request model access**
5. Find **Amazon Nova Lite** in the list
6. Check the box next to it
7. Click **Request model access** or **Save changes**
8. Wait for approval (usually instant)

**Supported Regions** for Bedrock (as of writing):
- us-east-1 (N. Virginia)
- us-west-2 (Oregon)
- eu-west-1 (Ireland)
- ap-northeast-1 (Tokyo)

Choose a region where Bedrock is available for deployment.

## Step 2: Install Project Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install

cd ..
```

## Step 3: Deploy Backend

### Quick Method (Using Makefile - Recommended)

```bash
# From project root
make deploy
```

This single command:
- Builds the backend
- Deploys to AWS (uses saved config from samconfig.toml)
- Shows outputs including API URL, Cognito IDs, etc.

For first-time deployment:

```bash
sam deploy --guided
```

Then use `make deploy` for subsequent deployments.

### Manual Method (Using SAM CLI)

```bash
# Build
sam build

# First-time deployment (guided)
sam deploy --guided
```

You'll be prompted with:

```
Stack Name [sam-app]: math-tutor-dev
AWS Region [us-east-1]: us-east-1
Parameter Environment [dev]: dev
Parameter AllowSignups [true]: true
Confirm changes before deploy [Y/n]: Y
Allow SAM CLI IAM role creation [Y/n]: Y
Disable rollback [y/N]: N
Save arguments to configuration file [Y/n]: Y
SAM configuration file [samconfig.toml]: samconfig.toml
SAM configuration environment [default]: default
```

**Important**:
- Choose a region where Bedrock is available
- Note the CloudFormation outputs at the end
- `AllowSignups` parameter controls new user registration (default: true)

### Subsequent Deployments

```bash
make deploy

# Or manually:
sam build && sam deploy
```

### Available Makefile Commands

```bash
make help             # Show all available commands
make build            # Build backend only
make deploy           # Build and deploy
make status           # Check stack status
make outputs          # Show stack outputs
make enable-signups   # Enable new user signups
make disable-signups  # Disable new user signups
make check-signups    # Check signup status
make logs             # View Lambda logs
make destroy          # Delete the stack
```

## Step 5: Configure Frontend

After deployment completes, SAM will output important values:

```
Outputs:
ApiUrl: https://xxxxx.execute-api.us-east-1.amazonaws.com/dev
UserPoolId: us-east-1_XXXXXXXXX
UserPoolClientId: xxxxxxxxxxxxxxxxxxxxxxxxxx
```

Create a `.env` file in the `frontend/` directory:

```bash
cd frontend
cp .env.example .env
```

Edit `.env` with your values:

```env
VITE_API_URL=<Your ApiUrl>
VITE_COGNITO_USER_POOL_ID=<Your UserPoolId>
VITE_COGNITO_CLIENT_ID=<Your UserPoolClientId>
```

## Step 6: Test Locally

```bash
# From frontend directory
npm run dev
```

Open http://localhost:3000 in your browser and test:
1. User registration
2. Login
3. Start a game
4. Request hints
5. Submit answers
6. View scorecard

## Step 7: Deploy Frontend to Production

### Recommended: S3 + CloudFront (Using Makefile)

The easiest and most cost-effective option with full automation:

```bash
cd frontend
make deploy
```

This single command:
1. Fetches backend configuration (API URL, Cognito IDs)
2. Builds the Vue.js application
3. Deploys CloudFormation infrastructure (S3 + CloudFront)
4. Uploads files with proper cache headers
5. Invalidates CloudFront cache
6. Shows deployment URLs

**Features included:**
- HTTPS enforcement (TLS 1.2+)
- Security headers (CSP, HSTS, XSS Protection)
- SPA routing support (404 → index.html)
- Aggressive caching for assets (1 year)
- Cost-optimized (PriceClass_100)
- Private S3 bucket (Origin Access Control)

**Estimated cost**: ~$1-3/month

For subsequent deployments (code changes only):

```bash
cd frontend
make quick-deploy
```

### Available Frontend Makefile Commands

```bash
make help                   # Show all commands
make deploy                 # Full deployment
make quick-deploy           # Code changes only (faster)
make update-infrastructure  # Update CloudFormation template
make outputs                # Show deployment URLs
make status                 # Check stack status
make check-invalidation     # Check CloudFront cache status
make clean                  # Remove build artifacts
make destroy                # Delete frontend infrastructure
```

See [frontend/MAKEFILE-GUIDE.md](frontend/MAKEFILE-GUIDE.md) for detailed documentation.

### Alternative: Manual S3 + CloudFront Setup

If you prefer manual setup:

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Deploy infrastructure:
   ```bash
   cd ..
   aws cloudformation deploy \
     --template-file frontend-infrastructure.yaml \
     --stack-name math-tutor-frontend-dev \
     --parameter-overrides Environment=dev
   ```

3. Upload files:
   ```bash
   BUCKET_NAME=$(aws cloudformation describe-stacks \
     --stack-name math-tutor-frontend-dev \
     --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
     --output text)

   aws s3 sync frontend/dist/ s3://${BUCKET_NAME}/ \
     --delete \
     --cache-control "public,max-age=31536000,immutable"
   ```

4. Invalidate cache:
   ```bash
   DIST_ID=$(aws cloudformation describe-stacks \
     --stack-name math-tutor-frontend-dev \
     --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
     --output text)

   aws cloudfront create-invalidation \
     --distribution-id ${DIST_ID} \
     --paths "/*"
   ```

### Alternative: Other Hosting Providers

The built files in `frontend/dist/` can be deployed to:
- Vercel
- Netlify
- GitHub Pages
- AWS Amplify Hosting

**Note**: You'll need to manually configure environment variables for these platforms.

## Step 8: Verify Deployment

1. Visit your deployed frontend URL
2. Register a new account
3. Check your email for verification (if enabled)
4. Login and play a game
5. Verify all features work:
   - Problem generation
   - Hint system
   - Answer submission
   - Scorecard display
   - Solution explanations

## Monitoring and Logs

### View Lambda Logs

```bash
sam logs -n CreateGameSessionFunction --stack-name math-tutor-dev --tail
```

### CloudWatch Insights

1. Go to AWS Console → CloudWatch
2. Navigate to **Log Insights**
3. Select Lambda log groups
4. Run queries to analyze errors or performance

### DynamoDB Metrics

1. Go to AWS Console → DynamoDB
2. Select your tables
3. View **Metrics** tab for:
   - Read/Write capacity
   - Throttles
   - Latency

## Updating the Application

### Update Backend

```bash
# Make your changes to Lambda functions
sam build
sam deploy
```

### Update Frontend

```bash
cd frontend
npm run build
# Deploy dist/ to your hosting service
```

## Troubleshooting

### Issue: Bedrock Access Denied

**Solution**:
1. Verify model access in Bedrock console
2. Check Lambda execution role has correct permissions
3. Ensure you're deploying to a Bedrock-supported region

### Issue: CORS Errors

**Solution**:
1. Verify `VITE_API_URL` matches API Gateway URL exactly
2. Check SAM template CORS configuration
3. Redeploy if CORS settings were changed

### Issue: Cognito Authentication Fails

**Solution**:
1. Verify User Pool ID and Client ID are correct
2. Check Cognito User Pool settings (email verification, etc.)
3. Ensure Cognito authorizer is properly configured in API Gateway

### Issue: Lambda Timeout

**Solution**:
1. Increase Lambda timeout in `template.yaml`
2. Optimize Bedrock prompts for faster responses
3. Consider using Nova Micro for even faster responses (if available)

## Cost Optimization

### Development
- Use On-Demand DynamoDB (pay only for what you use)
- Keep Lambda memory at 512MB
- Use Bedrock Nova Lite (cheapest option)

### Production
- Consider DynamoDB Provisioned Capacity for predictable costs
- Enable CloudFront caching for frontend
- Monitor and set up billing alerts

### Estimated Monthly Costs (100 games/day)
- Lambda: ~$1
- DynamoDB: ~$1-2
- API Gateway: ~$1
- Bedrock: ~$2-5
- Cognito: Free (under 50K MAU)
- **Total: ~$5-10/month**

## Cleanup/Teardown

To delete all AWS resources:

```bash
# Delete frontend
cd frontend
make destroy

# Delete backend
cd ..
make destroy
```

This will remove:
- CloudFront distribution and S3 bucket (frontend)
- Lambda functions (backend)
- API Gateway (backend)
- DynamoDB tables (backend)
- Cognito User Pool (backend)
- All associated resources

**Note**: This action cannot be undone. User data will be permanently deleted.

For detailed cleanup instructions, troubleshooting, and data export before deletion, see [CLEANUP.md](CLEANUP.md).

## Production Checklist

Before going to production:

- [ ] Enable CloudWatch alarms for errors and latency
- [ ] Set up AWS Budgets for cost monitoring
- [ ] Configure backup for DynamoDB tables
- [ ] Enable WAF for API Gateway (if needed)
- [ ] Set up custom domain name
- [ ] Configure email verification in Cognito
- [ ] Review and restrict IAM permissions
- [ ] Enable CloudTrail for audit logging
- [ ] Load test the application
- [ ] Set up monitoring dashboard

## Support

For deployment issues:
1. Check CloudFormation events in AWS Console
2. Review CloudWatch Logs
3. Consult AWS documentation
4. Open an issue on GitHub
