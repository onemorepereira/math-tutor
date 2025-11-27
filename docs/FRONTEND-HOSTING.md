# Frontend Hosting with S3 + CloudFront

This guide explains how to deploy the Math Tutor frontend to AWS using S3 + CloudFront for a secure, scalable, and cost-effective hosting solution.

## What You Get

- **S3 Bucket**: Stores your static files (HTML, CSS, JS)
- **CloudFront CDN**: Global content delivery with edge caching
- **Security**: HTTPS only, security headers (CSP, HSTS, etc.)
- **SPA Support**: Vue Router works correctly
- **Cost**: ~$1-3/month for typical traffic

## Prerequisites

- AWS CLI configured (`aws configure`)
- Backend stack deployed (provides API URL)
- Node.js and npm installed

## Quick Deployment

### 1. Make script executable

```bash
chmod +x deploy-frontend.sh
```

### 2. Run deployment

```bash
./deploy-frontend.sh dev
```

That's it! The script will:
1. Get your API URL from the backend stack
2. Create S3 + CloudFront infrastructure (first time only)
3. Build the Vue app
4. Upload with optimized cache headers
5. Invalidate CloudFront cache
6. Show you the live URL

## What Happens During Deployment

### First-Time Infrastructure Setup

Creates these AWS resources:

**S3 Bucket** (`math-tutor-frontend-dev-ACCOUNT_ID`):
- Versioning enabled
- Public access blocked
- Server-side encryption (AES256)
- Auto-delete old versions after 30 days

**CloudFront Distribution**:
- HTTPS redirect enabled
- Origin Access Control (secure S3 access)
- Security response headers
- SPA routing (404/403 → index.html)
- Gzip compression
- Global CDN caching

**Security Features**:
- HSTS (Strict-Transport-Security)
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- XSS Protection
- Content-Type-Options: nosniff

### Build & Upload Process

1. **Environment Configuration**: Creates `.env.production` with your API URL
2. **Build**: Runs `npm run build` to create production assets
3. **Smart Caching**:
   - HTML files: `no-cache` (always check for updates)
   - JS/CSS files: `max-age=31536000` (cache 1 year - safe due to content hashing)
4. **CloudFront Invalidation**: Clears cache for instant updates

## Manual Deployment (Step-by-Step)

If you prefer to understand each step:

### 1. Create Infrastructure

```bash
aws cloudformation create-stack \
  --stack-name math-tutor-frontend-dev \
  --template-body file://frontend-infrastructure.yaml \
  --parameters ParameterKey=Environment,ParameterValue=dev \
  --capabilities CAPABILITY_IAM

# Wait for completion (5-15 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name math-tutor-frontend-dev
```

### 2. Get Stack Outputs

```bash
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name math-tutor-frontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)

DISTRIBUTION=$(aws cloudformation describe-stacks \
  --stack-name math-tutor-frontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

URL=$(aws cloudformation describe-stacks \
  --stack-name math-tutor-frontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
  --output text)

echo "Bucket: $BUCKET"
echo "Distribution: $DISTRIBUTION"
echo "URL: https://$URL"
```

### 3. Build Frontend

```bash
cd frontend

# Get API URL from backend
API_URL=$(aws cloudformation describe-stacks \
  --stack-name math-tutor-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

# Configure production environment
echo "VITE_API_URL=${API_URL}" > .env.production

# Build
npm install
npm run build
```

### 4. Upload to S3

```bash
# HTML files - no cache
aws s3 sync dist/ s3://${BUCKET}/ \
  --exclude "*" \
  --include "*.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata-directive REPLACE \
  --delete

# Assets - long cache
aws s3 sync dist/ s3://${BUCKET}/ \
  --exclude "*.html" \
  --cache-control "public, max-age=31536000, immutable" \
  --metadata-directive REPLACE \
  --delete
```

### 5. Invalidate Cache

```bash
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION} \
  --paths "/*"
```

## Adding a Custom Domain

### Step 1: Request SSL Certificate (ACM)

**IMPORTANT**: Must be in `us-east-1` region for CloudFront!

```bash
aws acm request-certificate \
  --domain-name mathtutor.example.com \
  --validation-method DNS \
  --region us-east-1
```

Get the certificate ARN:

```bash
CERT_ARN=$(aws acm list-certificates \
  --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='mathtutor.example.com'].CertificateArn" \
  --output text)
```

**Follow DNS validation**: AWS will provide CNAME records to add to your DNS.

Wait for validation:

```bash
aws acm wait certificate-validated \
  --certificate-arn $CERT_ARN \
  --region us-east-1
```

### Step 2: Update CloudFormation Stack

```bash
aws cloudformation update-stack \
  --stack-name math-tutor-frontend-dev \
  --template-body file://frontend-infrastructure.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=dev \
    ParameterKey=DomainName,ParameterValue=mathtutor.example.com \
    ParameterKey=CertificateArn,ParameterValue=${CERT_ARN} \
  --capabilities CAPABILITY_IAM
```

### Step 3: Update DNS

Add a CNAME record to your DNS provider:

- **Type**: CNAME
- **Name**: `mathtutor` (or your subdomain)
- **Value**: Your CloudFront domain (e.g., `d111111abcdef8.cloudfront.net`)

Or use Route 53 with an Alias record for apex domain.

### Step 4: Update Backend CORS

Edit `template.yaml` in your backend:

```yaml
Cors:
  AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
  AllowHeaders: "'Content-Type,Authorization'"
  AllowOrigin: "'https://mathtutor.example.com'"  # Your domain
```

Redeploy backend:

```bash
sam build && sam deploy
```

## Architecture Details

### Security Configuration

**S3 Bucket Security**:
- All public access blocked
- Only CloudFront can access (via Origin Access Control)
- Encryption at rest (AES-256)
- Versioning enabled (rollback capability)
- Lifecycle policy (delete old versions after 30 days)

**CloudFront Security**:
- HTTPS redirect (no HTTP)
- TLS 1.2+ only
- Origin Access Control (OAC) - newer than OAI
- Security response headers:
  ```
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; ...
  ```

### Caching Strategy

**HTML Files** (`index.html`, etc.):
```
Cache-Control: no-cache, no-store, must-revalidate
```
Why: Always fetch latest HTML to get updated asset references

**JS/CSS Assets** (`app.abc123.js`, `style.xyz789.css`):
```
Cache-Control: public, max-age=31536000, immutable
```
Why: Content hash in filename means file never changes - cache forever

**CloudFront Behavior**:
- Default cache policy: CachingOptimized
- Compression: Enabled (gzip/brotli)
- Custom error responses for SPA routing

### SPA Routing Support

CloudFront custom error responses:

```yaml
403 → 200 /index.html  # S3 returns 403 for missing files
404 → 200 /index.html  # Redirect 404s to index for Vue Router
```

This ensures routes like `/stats`, `/game`, etc. work correctly.

## Cost Breakdown

### Infrastructure Costs

**S3**:
- Storage: $0.023/GB/month (~$0.10 for 5GB app)
- GET requests: $0.0004/1000 (~$0.01 for 25K requests)

**CloudFront**:
- Data transfer: First 1TB free, then $0.085/GB
- Requests: First 10M free, then $0.0075/10K
- Invalidations: First 1000/month free, then $0.005 each

**Route 53** (if using custom domain):
- Hosted zone: $0.50/month
- Queries: $0.40/million (first billion)

**Total Monthly Estimate**:
- Low traffic (<10K visitors): ~$1-2
- Medium traffic (100K visitors): ~$5-10
- High traffic (1M visitors): ~$50-100

### Cost Optimization Tips

1. **Minimize invalidations**: Only invalidate on deploy, not individual files
2. **Use price class 100**: North America + Europe only (already configured)
3. **Enable compression**: Reduces data transfer (already enabled)
4. **Long cache TTL**: Reduces origin requests (already configured)
5. **Monitor CloudWatch**: Set up billing alarms

## Monitoring & Debugging

### Check Deployment Status

```bash
# CloudFront distribution status
aws cloudfront get-distribution \
  --id ${DISTRIBUTION} \
  --query "Distribution.Status"
```

### View CloudFront Cache Statistics

```bash
# Get cache hit ratio
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=${DISTRIBUTION} \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

### Common Issues

**Problem**: Getting 403 errors
- **Solution**: Check S3 bucket policy allows CloudFront OAC
- Verify OAC is attached to CloudFront origin

**Problem**: Vue Router routes showing 404
- **Solution**: Check CloudFront custom error responses
- Verify error responses redirect to `/index.html`

**Problem**: Old version still showing
- **Solution**: Create invalidation: `aws cloudfront create-invalidation --distribution-id $DISTRIBUTION --paths "/*"`
- Check browser cache (Ctrl+Shift+R for hard refresh)

**Problem**: API calls failing with CORS
- **Solution**: Update backend CORS with CloudFront URL
- Verify `.env.production` has correct API_URL
- Check browser console for specific error

**Problem**: SSL certificate errors
- **Solution**: Verify certificate is in `us-east-1`
- Check certificate status is ISSUED
- Ensure domain matches certificate

## Updating Your Application

### Regular Updates

```bash
./deploy-frontend.sh dev
```

That's it! The script handles everything.

### What Gets Updated

- New JavaScript bundles (with new content hashes)
- Updated HTML (references new bundles)
- CloudFront cache cleared automatically
- Changes live in 1-2 minutes globally

### Zero-Downtime Deployments

CloudFront + S3 provides atomic deployments:
1. Upload new files to S3
2. Update index.html (last)
3. Invalidate cache
4. Users get new version on next request

Old bundles remain accessible during rollout since they have different hashes.

## Rollback Procedure

S3 versioning is enabled, so you can rollback:

```bash
# List versions
aws s3api list-object-versions \
  --bucket ${BUCKET} \
  --prefix index.html

# Copy previous version as current
aws s3api copy-object \
  --bucket ${BUCKET} \
  --copy-source ${BUCKET}/index.html?versionId=VERSION_ID \
  --key index.html

# Invalidate
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION} \
  --paths "/*"
```

## Cleanup

To delete all resources:

```bash
# Empty bucket (required before deleting)
aws s3 rm s3://${BUCKET}/ --recursive

# Delete all versions
aws s3api delete-objects \
  --bucket ${BUCKET} \
  --delete "$(aws s3api list-object-versions \
    --bucket ${BUCKET} \
    --output json \
    --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}')"

# Delete stack
aws cloudformation delete-stack \
  --stack-name math-tutor-frontend-dev

# Wait
aws cloudformation wait stack-delete-complete \
  --stack-name math-tutor-frontend-dev
```

## Production Checklist

Before going live:

- [ ] Set up custom domain with SSL
- [ ] Update backend CORS to production domain
- [ ] Enable CloudFront access logs
- [ ] Set up CloudWatch alarms (errors, latency)
- [ ] Configure AWS WAF (optional, for DDoS protection)
- [ ] Set up billing alerts
- [ ] Test from multiple geographic locations
- [ ] Verify all security headers
- [ ] Load test the application
- [ ] Document rollback procedure

## Next Steps

1. **Deploy**: Run `./deploy-frontend.sh dev`
2. **Test**: Visit the CloudFront URL
3. **Custom Domain**: Follow the custom domain steps (optional)
4. **Monitor**: Set up CloudWatch dashboards
5. **Optimize**: Review cache hit ratio after a week

## Support

For issues:
- Check CloudFormation events in AWS Console
- Review CloudFront distribution settings
- Check S3 bucket policy
- Verify security groups and IAM permissions
- Consult [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
