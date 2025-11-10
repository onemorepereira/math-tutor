# Signup Control Guide

Quick reference for enabling/disabling new user signups in the Math Tutor application.

## Quick Commands

```bash
# Disable signups (about 1-2 minutes)
make disable-signups

# Enable signups (about 1-2 minutes)
make enable-signups

# Check current status
make check-signups
```

## How It Works

The signup control feature uses a CloudFormation parameter (`AllowSignups`) that controls an environment variable in all Lambda functions. The `RegisterUserFunction` checks this value before allowing new user registrations.

**When signups are disabled:**
- Existing users can still log in and use the app
- New users trying to sign up get a "403 Forbidden" error
- The error message: "New signups are currently disabled"
- Frontend will display the error to users attempting registration

**When signups are enabled:**
- New users can register normally
- This is the default state

## Detailed Usage

### Disable Signups

```bash
make disable-signups
```

**What it does:**
1. Builds the backend
2. Deploys with `AllowSignups=false` parameter
3. Updates all Lambda functions (~1-2 minutes)
4. Verifies the change

**Use cases:**
- Limiting beta access
- Maintenance periods
- Reached user capacity
- Testing with existing users only

### Enable Signups

```bash
make enable-signups
```

**What it does:**
1. Builds the backend
2. Deploys with `AllowSignups=true` parameter
3. Updates all Lambda functions (~1-2 minutes)
4. Verifies the change

### Check Status

```bash
make check-signups
```

Shows current signup status without making changes:
- ✓ Signups are ENABLED (green)
- ✗ Signups are DISABLED (yellow)

### Test Signup Endpoint

```bash
make test-signup-enabled
```

Makes a test API call to verify if signups are working:
- 403 = Signups disabled
- 400 = Signups enabled (validation error from test data)

## Architecture

### Backend Changes

**File: `backend/src/functions/register.ts`**
```typescript
// Check if signups are enabled
const allowSignups = process.env.ALLOW_SIGNUPS !== 'false'
if (!allowSignups) {
  return createErrorResponse(403, 'New signups are currently disabled')
}
```

**File: `template.yaml`**
```yaml
Parameters:
  AllowSignups:
    Type: String
    Default: 'true'
    AllowedValues:
      - 'true'
      - 'false'

Globals:
  Function:
    Environment:
      Variables:
        ALLOW_SIGNUPS: !Ref AllowSignups
```

### Why This Approach?

**Quick**: Just update a parameter and redeploy (~1-2 minutes)
**Effective**: Blocks at the Lambda level (can't be bypassed from frontend)
**Reliable**: Uses CloudFormation parameter validation
**Reversible**: Easy to enable/disable without code changes
**Safe**: Existing users are unaffected

## Deployment Time

**Standard deployment**: ~1-2 minutes
- SAM builds all Lambda functions
- CloudFormation updates function configurations
- Changes take effect immediately after deployment

## Frontend Handling

The frontend should gracefully handle the 403 error:

```typescript
try {
  await authService.register(email, password, ageGroup)
} catch (error) {
  if (error.response?.status === 403) {
    // Show "Signups are currently disabled" message
  }
}
```

Consider adding a banner or message on the signup page when this is a planned limitation (e.g., "Beta access limited").

## Troubleshooting

### "Could not determine signup status"
- Make sure the backend stack is deployed: `make status`
- Check stack name matches: `math-tutor-dev` (default)

### Changes not taking effect
- Wait 1-2 minutes after deployment
- Check CloudFormation events: `aws cloudformation describe-stack-events --stack-name math-tutor-dev --max-items 10`
- Verify parameter value: `make outputs` (look for AllowSignups in Parameters section)

### Want to disable for multiple environments
```bash
# Dev environment (default)
make disable-signups ENV=dev

# Production environment
make disable-signups ENV=prod
```

## Alternative: Manual Deployment

If you prefer not to use the Makefile:

```bash
# Disable signups
sam build && sam deploy --resolve-s3 --no-confirm-changeset \
  --parameter-overrides Environment=dev AllowSignups=false

# Enable signups
sam build && sam deploy --resolve-s3 --no-confirm-changeset \
  --parameter-overrides Environment=dev AllowSignups=true
```

## Security Considerations

- **Cannot be bypassed from frontend**: The check happens in the Lambda function
- **Cognito still works**: Users can't create accounts in DynamoDB, but Cognito verification might still complete (they'll hit the error when trying to create the user record)
- **Consider adding IP whitelist**: For private beta, consider adding IP restrictions in API Gateway
- **Rate limiting**: Consider adding rate limiting to prevent signup attempts

## Future Enhancements

Potential improvements to the signup control:
1. **Invite codes**: Allow signups only with valid invite codes
2. **Waitlist**: Collect emails of users who try to sign up when disabled
3. **Scheduled enable/disable**: Automatically enable signups at a certain date
4. **Per-age-group limits**: Disable signups for specific age groups
5. **User cap**: Automatically disable when reaching a certain user count

## Related Commands

```bash
# View all backend commands
make help

# Check backend stack status
make status

# View backend outputs (including AllowSignups parameter)
make outputs

# View register function logs
make logs
```
