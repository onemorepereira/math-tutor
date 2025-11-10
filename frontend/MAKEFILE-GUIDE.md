# Frontend Makefile Guide

Quick reference for deploying and managing the Math Tutor frontend.

## Quick Start

```bash
# Full deployment (first time or after infrastructure changes)
make deploy

# Quick deployment (code changes only)
make quick-deploy

# Development server
make dev
```

## Common Commands

### Deployment Commands

| Command | Description | Use When |
|---------|-------------|----------|
| `make deploy` | Full deployment (build + infrastructure + upload + invalidate) | First deployment or after template changes |
| `make quick-deploy` | Build, upload, and invalidate cache (skip infrastructure) | Code changes only (most common) |
| `make update-infrastructure` | Update only CloudFormation stack | Changed CSP, security headers, or other infrastructure settings |

### Individual Steps

| Command | Description |
|---------|-------------|
| `make build` | Build the frontend and fetch backend config |
| `make deploy-infrastructure` | Deploy/update CloudFormation stack |
| `make upload` | Upload built files to S3 |
| `make invalidate` | Invalidate CloudFront cache |

### Information & Monitoring

| Command | Description |
|---------|-------------|
| `make outputs` | Show deployment info (URLs, bucket name, etc.) |
| `make status` | Check backend and frontend stack status |
| `make logs` | Show CloudFront distribution status |
| `make check-invalidation` | Check status of recent cache invalidations |

### Utilities

| Command | Description |
|---------|-------------|
| `make clean` | Remove build artifacts and .env.production |
| `make dev` | Run local development server |
| `make destroy` | Delete the entire frontend stack (⚠️ destructive!) |
| `make help` | Show all available commands |

## Common Workflows

### 1. First Time Deployment

```bash
cd frontend
make deploy
```

This will:
1. Fetch backend configuration (API URL, Cognito credentials)
2. Build the frontend application
3. Deploy CloudFormation infrastructure (S3 + CloudFront)
4. Upload files to S3
5. Invalidate CloudFront cache
6. Show deployment URLs

### 2. Code Changes (Most Common)

```bash
cd frontend
make quick-deploy
```

This skips infrastructure deployment and just builds/uploads/invalidates.

### 3. Infrastructure Changes

If you modified `frontend-infrastructure.yaml` (e.g., changed CSP, security headers):

```bash
cd frontend
make update-infrastructure
```

### 4. Check Deployment Info

```bash
make outputs
```

Shows:
- Website URL
- S3 bucket name
- CloudFront distribution ID
- API URL

### 5. Development

```bash
make dev
```

Runs the Vite development server locally.

## Environment Variables

By default, the Makefile uses:
- `ENV=dev` (environment)
- `REGION=us-east-1` (AWS region)

Override these:

```bash
# Deploy to production
make deploy ENV=prod

# Use different region
make deploy REGION=us-west-2
```

## What Happens During Deployment

### `make build`
1. Fetches backend configuration from CloudFormation stack
2. Creates `.env.production` with:
   - `VITE_API_URL` (API Gateway URL)
   - `VITE_COGNITO_USER_POOL_ID`
   - `VITE_COGNITO_CLIENT_ID`
3. Runs `npm run build:prod` (Vite build without type checking)

### `make deploy-infrastructure`
1. Deploys CloudFormation template (`../frontend-infrastructure.yaml`)
2. Creates/updates:
   - S3 bucket (private, encrypted, versioned)
   - CloudFront distribution (with OAC, security headers, SPA routing)
   - Security response headers policy

### `make upload`
1. Uploads all files to S3 with appropriate cache headers:
   - Content-hashed files (JS, CSS): 1 year cache
   - `index.html`: No cache (must-revalidate)
   - `robots.txt`: 1 hour cache
2. Uses `--delete` to remove old files

### `make invalidate`
1. Creates CloudFront invalidation for `/*`
2. Typically takes 1-2 minutes to complete
3. Forces CloudFront to fetch fresh content from S3

## Troubleshooting

### "Could not retrieve backend configuration"
- Make sure the backend stack is deployed: `cd .. && sam deploy`
- Check stack name matches: `aws cloudformation list-stacks`

### "Could not find S3 bucket"
- Run `make deploy-infrastructure` first

### Changes not appearing on website
1. Check invalidation status: `make check-invalidation`
2. Hard refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
3. Wait 1-2 minutes for CloudFront cache to clear

### Build fails
- Ensure `npm install` has been run
- Check Node.js version: `node --version` (should be 18+)
- Clean and rebuild: `make clean && make build`

## Cost Optimization

The Makefile uses these cost-saving settings (configured in `frontend-infrastructure.yaml`):
- `PriceClass_100` (cheapest CloudFront regions)
- Aggressive caching (reduces S3 requests)
- Compression enabled
- Estimated cost: ~$1-3/month

## Security Features

Deployed automatically:
- HTTPS only (TLS 1.2+)
- Security headers (CSP, HSTS, XSS Protection, etc.)
- Private S3 bucket (Origin Access Control)
- No public S3 access

## Tips

1. **Use `quick-deploy` for development**: Saves time by skipping infrastructure updates
2. **Monitor invalidations**: Use `make check-invalidation` to see when cache is cleared
3. **Check outputs regularly**: `make outputs` shows current deployment info
4. **Set up aliases**: Add to your `.bashrc`:
   ```bash
   alias fd='cd ~/path/to/frontend && make quick-deploy'
   ```

## Examples

```bash
# Full deployment with custom environment
make deploy ENV=prod

# Just rebuild and upload (fastest for testing)
make build upload

# Check if deployment is working
make status
make outputs

# Update security headers
# 1. Edit ../frontend-infrastructure.yaml
# 2. Run:
make update-infrastructure

# Clean everything and start fresh
make clean
make deploy
```
