# Cleanup / Infrastructure Destruction Guide

This guide provides step-by-step instructions for cleanly destroying all AWS infrastructure created by the Math Tutor application.

## Warning

**⚠️ IMPORTANT**: Destroying infrastructure is **permanent** and **irreversible**. All data will be lost, including:

- User accounts and profiles
- Game sessions and history
- Leaderboard data
- Activity statistics
- Cached data

Make sure you have backups of any data you want to preserve before proceeding.

## Order of Destruction

Infrastructure should be destroyed in this order to avoid dependency issues:

1. Frontend (CloudFront + S3)
2. Backend (Lambda, API Gateway, DynamoDB, Cognito)

## Method 1: Using Make Commands (Recommended)

### Step 1: Destroy Frontend Infrastructure

```bash
cd frontend
make destroy
```

**What this does:**

1. Prompts for confirmation
2. Empties the S3 bucket (required before deletion)
3. Deletes the CloudFormation stack containing:
   - CloudFront distribution
   - S3 bucket
   - Security headers policy
   - Origin Access Control

**Time**: 10-15 minutes (CloudFront distributions take time to delete)

**Verification:**

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name math-tutor-frontend-dev

# Should return: Stack with id math-tutor-frontend-dev does not exist
```

### Step 2: Destroy Backend Infrastructure

```bash
cd ..
make destroy
```

**What this does:**

1. Prompts for stack name confirmation
2. Deletes the CloudFormation stack containing:
   - All Lambda functions (11 functions)
   - API Gateway REST API
   - DynamoDB tables (3 tables):
     - UserTable
     - GameSessionTable
     - PublicStatsCache
   - Cognito User Pool and Client
   - CloudWatch Log Groups
   - IAM roles and policies

**Time**: 2-5 minutes

**Verification:**

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name math-tutor-dev

# Should return: Stack with id math-tutor-dev does not exist
```

## Method 2: Manual Deletion via AWS Console

### Step 1: Delete Frontend Stack

1. Go to AWS Console → CloudFormation
2. Select stack: `math-tutor-frontend-dev`
3. Click **Delete**
4. Confirm deletion

**Note**: If deletion fails due to non-empty S3 bucket:

```bash
# Empty the bucket first
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name math-tutor-frontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)

aws s3 rm s3://${BUCKET_NAME}/ --recursive
```

Then retry deletion in CloudFormation console.

### Step 2: Delete Backend Stack

1. Go to AWS Console → CloudFormation
2. Select stack: `math-tutor-dev`
3. Click **Delete**
4. Confirm deletion

## Method 3: Using AWS CLI Directly

### Step 1: Delete Frontend

```bash
# Get bucket name
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name math-tutor-frontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)

# Empty bucket
aws s3 rm s3://${BUCKET_NAME}/ --recursive

# Delete stack
aws cloudformation delete-stack --stack-name math-tutor-frontend-dev

# Monitor deletion
aws cloudformation wait stack-delete-complete --stack-name math-tutor-frontend-dev
```

### Step 2: Delete Backend

```bash
# Delete stack
aws cloudformation delete-stack --stack-name math-tutor-dev

# Monitor deletion
aws cloudformation wait stack-delete-complete --stack-name math-tutor-dev
```

## Method 4: Using SAM CLI

```bash
# Delete backend only (SAM manages this stack)
sam delete --stack-name math-tutor-dev --no-prompts

# Frontend must be deleted separately (not managed by SAM)
cd frontend && make destroy
```

## Verification Checklist

After deletion, verify all resources are removed:

### Frontend Resources

```bash
# CloudFormation stack
aws cloudformation describe-stacks --stack-name math-tutor-frontend-dev
# Expected: Stack not found error

# S3 bucket
aws s3 ls | grep math-tutor-frontend
# Expected: No results

# CloudFront distributions
aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='Math Tutor Frontend - dev'].Id"
# Expected: Empty or null
```

### Backend Resources

```bash
# CloudFormation stack
aws cloudformation describe-stacks --stack-name math-tutor-dev
# Expected: Stack not found error

# Lambda functions
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'math-tutor')].FunctionName"
# Expected: Empty array

# DynamoDB tables
aws dynamodb list-tables --query "TableNames[?starts_with(@, 'math-tutor')]"
# Expected: Empty array

# Cognito User Pools
aws cognito-idp list-user-pools --max-results 10 --query "UserPools[?Name=='math-tutor-users-dev']"
# Expected: Empty array

# API Gateway
aws apigateway get-rest-apis --query "items[?name=='math-tutor-dev']"
# Expected: Empty array
```

## Partial Cleanup (Keep Some Resources)

### Keep Backend, Delete Frontend Only

```bash
cd frontend
make destroy
```

Use case: Testing different frontend hosting options

### Keep Frontend, Delete Backend Only

```bash
make destroy
```

Use case: Rebuilding backend from scratch

## Troubleshooting Deletion Issues

### Issue: Stack deletion fails

**Possible causes:**

- Resources have dependencies
- Manual changes made outside CloudFormation
- Resources in use

**Solution:**

1. Check CloudFormation events for specific errors:

   ```bash
   aws cloudformation describe-stack-events --stack-name math-tutor-dev --max-items 20
   ```

2. Manually delete blocking resources in AWS Console

3. Retry stack deletion

### Issue: S3 bucket deletion fails

**Error**: "Bucket not empty"

**Solution:**

```bash
BUCKET_NAME=<your-bucket-name>
aws s3 rm s3://${BUCKET_NAME}/ --recursive
aws s3api delete-bucket --bucket ${BUCKET_NAME}
```

### Issue: CloudFront distribution won't delete

**Error**: "Distribution must be disabled"

**Solution:**

1. Disable the distribution:

   ```bash
   DIST_ID=<your-distribution-id>
   # Get current config
   aws cloudfront get-distribution-config --id ${DIST_ID} > dist-config.json

   # Edit dist-config.json: set "Enabled": false

   # Update distribution
   aws cloudfront update-distribution --id ${DIST_ID} --if-match <etag> --distribution-config file://dist-config.json
   ```

2. Wait 10-15 minutes for distribution to deploy

3. Delete the distribution:

   ```bash
   aws cloudfront delete-distribution --id ${DIST_ID} --if-match <etag>
   ```

### Issue: DynamoDB table has deletion protection

**Error**: "Table is protected from deletion"

**Solution:**

1. Disable deletion protection:

   ```bash
   aws dynamodb update-table \
     --table-name math-tutor-users-dev \
     --deletion-protection-enabled false
   ```

2. Retry stack deletion

### Issue: Cognito User Pool has users

**Note**: This shouldn't prevent deletion, but if it does:

**Solution:**

```bash
USER_POOL_ID=<your-pool-id>

# List users
aws cognito-idp list-users --user-pool-id ${USER_POOL_ID}

# Delete all users
aws cognito-idp list-users --user-pool-id ${USER_POOL_ID} \
  --query "Users[].Username" --output text | \
  xargs -I {} aws cognito-idp admin-delete-user --user-pool-id ${USER_POOL_ID} --username {}
```

## Cost After Deletion

After successful deletion:

- **Immediate**: All ongoing costs stop
- **Final bill**: You'll be charged for any usage up to deletion time
- **Log retention**: CloudWatch logs may remain (7 days retention as configured)
- **No data storage costs**: All data deleted

## Data Export Before Deletion

If you want to preserve data before destroying infrastructure:

### Export User Data

```bash
aws dynamodb scan --table-name math-tutor-users-dev > users-backup.json
```

### Export Game Sessions

```bash
aws dynamodb scan --table-name math-tutor-sessions-dev > sessions-backup.json
```

### Export Cognito Users

```bash
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name math-tutor-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

aws cognito-idp list-users --user-pool-id ${USER_POOL_ID} > cognito-users-backup.json
```

### Export CloudWatch Logs

```bash
# List log groups
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/math-tutor

# Export specific log group
aws logs create-export-task \
  --log-group-name /aws/lambda/math-tutor-dev-CreateGameSessionFunction \
  --from $(date -d '30 days ago' +%s)000 \
  --to $(date +%s)000 \
  --destination <your-s3-bucket>
```

## Re-deployment After Cleanup

To redeploy after cleanup:

```bash
# Deploy backend
make deploy

# Deploy frontend
cd frontend
make deploy
```

All data will be fresh - no previous users, sessions, or scores will exist.

## Clean Development Environment

Remove local development artifacts:

```bash
# Clean backend build artifacts
rm -rf .aws-sam/
rm -rf backend/node_modules/
rm -rf backend/dist/

# Clean frontend build artifacts
rm -rf frontend/node_modules/
rm -rf frontend/dist/
rm -rf frontend/.env.production

# Clean root node_modules
rm -rf node_modules/
```

## Summary Checklist

Before destroying infrastructure:

- [ ] Export any data you want to keep
- [ ] Take note of current configuration (if redeploying later)
- [ ] Verify you're destroying the correct environment (dev/prod)
- [ ] Inform users if this is a production system
- [ ] Verify Makefile commands work in your environment

Destruction order:

- [ ] Destroy frontend stack (10-15 minutes)
- [ ] Verify frontend stack deleted
- [ ] Destroy backend stack (2-5 minutes)
- [ ] Verify backend stack deleted
- [ ] Verify all resources removed via AWS Console
- [ ] Check final AWS bill after deletion

## Support

If you encounter issues during cleanup:

1. Check CloudFormation events for specific errors
2. Review CloudWatch logs for details
3. Consult AWS documentation
4. Open an issue on GitHub with error details
