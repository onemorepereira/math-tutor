# Git Guidelines - What to Commit and What to Ignore

This document outlines what files should and should not be committed to version control.

## ✅ Files That SHOULD Be Committed

### Source Code
- All `.ts`, `.tsx`, `.vue`, `.js`, `.jsx` files in `src/`
- All component files
- All utility and helper files
- Test files

### Configuration Templates
- `frontend/.env.example` - Environment variable template (with placeholders)
- `template.yaml` - SAM/CloudFormation template
- `frontend-infrastructure.yaml` - Frontend infrastructure template
- `package.json` files
- `tsconfig.json` files
- `vite.config.ts`
- Makefile files

### Documentation
- All `*.md` files
- README, guides, documentation
- Architecture diagrams (if any)

### Lock Files (Recommended)
- `package-lock.json` - Ensures consistent dependencies
- Can be excluded if team prefers, but recommended for consistency

## ❌ Files That SHOULD NOT Be Committed

### Environment Variables & Secrets
- ❌ `.env` - Local development environment
- ❌ `.env.local` - Local overrides
- ❌ `.env.production` - **IMPORTANT**: Contains actual API URLs and Cognito IDs
- ❌ `.env.development.local`
- ❌ `.env.test.local`
- ❌ `.env.production.local`

### AWS Credentials & Configuration
- ❌ `samconfig.toml` - Contains deployment configuration (stack names, regions)
- ❌ `.aws/` directory
- ❌ `.aws/credentials`
- ❌ `.aws/config`
- ❌ `credentials` or `credentials.json`
- ❌ Any `.pem` or `.key` files
- ❌ SSH keys
- ❌ API keys or tokens

### Build Artifacts
- ❌ `dist/` - Frontend build output
- ❌ `backend/dist/` - Backend compiled JavaScript
- ❌ `.aws-sam/` - SAM build artifacts
- ❌ `build/`
- ❌ `*.js.map` - Source maps
- ❌ `*.tsbuildinfo` - TypeScript build info

### Dependencies
- ❌ `node_modules/` - **NEVER commit this** (huge, can be regenerated)
- ❌ `.pnp` and `.pnp.js` - Yarn PnP

### Logs & Debug Files
- ❌ `*.log` - All log files
- ❌ `npm-debug.log*`
- ❌ `yarn-debug.log*`
- ❌ `yarn-error.log*`
- ❌ `pnpm-debug.log*`

### OS & Editor Files
- ❌ `.DS_Store` - macOS metadata
- ❌ `Thumbs.db` - Windows thumbnails
- ❌ `.vscode/` - VS Code settings (unless shared team settings)
- ❌ `.idea/` - JetBrains IDE
- ❌ `*.swp`, `*.swo`, `*~` - Vim swap files
- ❌ `.Spotlight-V100`, `.Trashes` - macOS
- ❌ `Desktop.ini` - Windows

### Temporary & Cache Files
- ❌ `*.tmp`, `*.temp`
- ❌ `*.bak`, `*.backup`
- ❌ `*.cache`
- ❌ `.eslintcache`
- ❌ `.stylelintcache`

## 🔍 Verification Checklist

Before committing, verify:

### 1. Check for Sensitive Data
```bash
# Search for potential secrets in staged files
git grep -i "password\|secret\|api[_-]?key\|token" $(git diff --cached --name-only)

# Check .env files are not staged
git status | grep "\.env"
```

### 2. Check File Sizes
```bash
# Find large files that might be accidentally staged
git ls-files --cached | xargs ls -lh | sort -k5 -h -r | head -20
```

### 3. Review Staged Changes
```bash
# Always review what you're about to commit
git diff --cached

# Check status
git status
```

## 🚨 If You Accidentally Committed Sensitive Data

If you accidentally committed sensitive information:

### 1. Remove from Latest Commit (Not Yet Pushed)
```bash
# Remove the file from git but keep it locally
git rm --cached <file>

# Amend the commit
git commit --amend

# Update .gitignore
echo "<file>" >> .gitignore
git add .gitignore
git commit -m "Add file to .gitignore"
```

### 2. Already Pushed to Remote
```bash
# Remove from entire git history (DANGEROUS - rewrites history)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <file>" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (coordinate with team first!)
git push origin --force --all
git push origin --force --tags
```

**Better approach**: If credentials were exposed:
1. **Immediately revoke/rotate the credentials**
2. Generate new credentials
3. Update your `.env` files
4. Add to `.gitignore`
5. Inform your team

### 3. Use BFG Repo-Cleaner (Easier)
```bash
# Install BFG (https://rtyley.github.io/bfg-repo-cleaner/)
# Remove file from history
bfg --delete-files <filename>

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push --force
```

## 📋 Current .gitignore Coverage

### Root `.gitignore`
- ✅ Environment files (`.env*`)
- ✅ Node modules
- ✅ Build artifacts (`dist/`, `.aws-sam/`)
- ✅ AWS configuration (`samconfig.toml`)
- ✅ Credentials (`.aws/`, `*.pem`, `*.key`)
- ✅ IDE files (`.vscode/`, `.idea/`)
- ✅ OS files (`.DS_Store`, `Thumbs.db`)
- ✅ Logs (`*.log`)
- ✅ Temporary files (`*.bak`, `*.tmp`)

### Frontend `.gitignore`
- ✅ Environment files including `.env.production`
- ✅ Node modules
- ✅ Build output (`dist/`)
- ✅ IDE files
- ✅ OS files
- ✅ Logs

### Backend `.gitignore`
- ✅ Node modules
- ✅ Build output (`dist/`)
- ✅ Environment files
- ✅ Credentials
- ✅ IDE and OS files

## 🔐 Security Best Practices

### 1. Never Commit Credentials
- Use environment variables for all secrets
- Use AWS Secrets Manager or Parameter Store for production
- Use `.env.example` as a template with placeholder values

### 2. Use Pre-commit Hooks
Consider adding a pre-commit hook to check for secrets:

```bash
# .git/hooks/pre-commit
#!/bin/bash
if git diff --cached | grep -E "password|secret|api[_-]?key|token"; then
    echo "❌ Potential secret detected! Commit blocked."
    exit 1
fi
```

### 3. Regular Audits
```bash
# Scan for accidentally committed secrets
git log -p | grep -i "password\|secret\|api[_-]?key"
```

### 4. Environment-Specific Files
- Development: `.env` (local only, not committed)
- Production: `.env.production` (generated by deployment, not committed)
- Template: `.env.example` (safe to commit, contains placeholders)

## 🎯 Quick Reference

| File Type | Commit? | Reason |
|-----------|---------|---------|
| `.env` | ❌ | Contains secrets |
| `.env.example` | ✅ | Template with placeholders |
| `.env.production` | ❌ | Contains actual production URLs/IDs |
| `samconfig.toml` | ❌ | Environment-specific deployment config |
| `node_modules/` | ❌ | Huge, regenerable from package.json |
| `dist/` | ❌ | Build artifact, regenerable |
| `.aws-sam/` | ❌ | SAM build cache |
| `package.json` | ✅ | Defines dependencies |
| `package-lock.json` | ✅ | Locks dependency versions |
| `template.yaml` | ✅ | Infrastructure as Code |
| `*.md` | ✅ | Documentation |
| Source files (`.ts`, `.vue`) | ✅ | Your code! |

## 📝 Commit Message Guidelines

Good commit messages:
```
✅ feat: Add user authentication with Cognito
✅ fix: Resolve CORS issue in API Gateway
✅ docs: Update deployment guide
✅ refactor: Extract hint logic to separate service
```

Bad commit messages:
```
❌ "update"
❌ "fix stuff"
❌ "asdf"
❌ "WIP" (work in progress - should be squashed before merge)
```

## 🔄 Before Every Commit

1. ✅ Review changes: `git diff`
2. ✅ Check status: `git status`
3. ✅ Verify no secrets: `git grep -i "password\|secret\|api.*key"`
4. ✅ Stage files: `git add <files>`
5. ✅ Review staged: `git diff --cached`
6. ✅ Commit with message: `git commit -m "message"`
7. ✅ Push: `git push`

---

**Remember**: It's much easier to prevent committing sensitive data than to remove it from history!
