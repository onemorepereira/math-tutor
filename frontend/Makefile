.PHONY: help build deploy-infrastructure upload invalidate deploy clean outputs dev

# Environment configuration
ENV ?= dev
BACKEND_STACK_NAME = math-tutor-$(ENV)
FRONTEND_STACK_NAME = math-tutor-frontend-$(ENV)
REGION ?= us-east-1

# Colors for output
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[1;33m
NC = \033[0m # No Color

help: ## Show this help message
	@echo "$(GREEN)Math Tutor Frontend Makefile$(NC)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

get-backend-config: ## Fetch backend configuration (API URL, Cognito credentials)
	@echo "$(GREEN)Fetching backend configuration...$(NC)"
	@API_URL=$$(aws cloudformation describe-stacks \
		--stack-name "$(BACKEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
		--output text); \
	USER_POOL_ID=$$(aws cloudformation describe-stacks \
		--stack-name "$(BACKEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
		--output text); \
	CLIENT_ID=$$(aws cloudformation describe-stacks \
		--stack-name "$(BACKEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
		--output text); \
	if [ -z "$$API_URL" ] || [ -z "$$USER_POOL_ID" ] || [ -z "$$CLIENT_ID" ]; then \
		echo "$(RED)Error: Could not retrieve backend configuration$(NC)"; \
		echo "Make sure the backend stack '$(BACKEND_STACK_NAME)' is deployed"; \
		exit 1; \
	fi; \
	echo "# API Configuration" > .env.production; \
	echo "VITE_API_URL=$$API_URL" >> .env.production; \
	echo "" >> .env.production; \
	echo "# AWS Cognito Configuration" >> .env.production; \
	echo "VITE_COGNITO_USER_POOL_ID=$$USER_POOL_ID" >> .env.production; \
	echo "VITE_COGNITO_CLIENT_ID=$$CLIENT_ID" >> .env.production; \
	echo "$(GREEN)✓ Configuration saved to .env.production$(NC)"

build: get-backend-config ## Build the frontend application
	@echo "$(GREEN)Building frontend...$(NC)"
	npm run build:prod
	@echo "$(GREEN)✓ Build complete$(NC)"

deploy-infrastructure: ## Deploy/update CloudFormation infrastructure (S3 + CloudFront)
	@echo "$(GREEN)Deploying frontend infrastructure...$(NC)"
	@if [ -f .env.cloudformation ]; then \
		set -a && . ./.env.cloudformation && set +a && \
		cd .. && aws cloudformation deploy \
			--template-file frontend-infrastructure.yaml \
			--stack-name "$(FRONTEND_STACK_NAME)" \
			--parameter-overrides \
				Environment=$(ENV) \
				DomainName=$${DOMAIN_NAME} \
				CertificateArn=$${CERTIFICATE_ARN} \
				ApiDomainPattern=$${API_DOMAIN_PATTERN} \
			--region $(REGION) \
			--no-fail-on-empty-changeset; \
	else \
		echo "$(YELLOW)Warning: .env.cloudformation not found. Deploying without custom domain.$(NC)"; \
		cd .. && aws cloudformation deploy \
			--template-file frontend-infrastructure.yaml \
			--stack-name "$(FRONTEND_STACK_NAME)" \
			--parameter-overrides Environment=$(ENV) \
			--region $(REGION) \
			--no-fail-on-empty-changeset; \
	fi
	@echo "$(GREEN)✓ Infrastructure deployed$(NC)"

upload: ## Upload built files to S3
	@echo "$(GREEN)Uploading files to S3...$(NC)"
	@BUCKET_NAME=$$(aws cloudformation describe-stacks \
		--stack-name "$(FRONTEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
		--output text); \
	if [ -z "$$BUCKET_NAME" ]; then \
		echo "$(RED)Error: Could not find S3 bucket$(NC)"; \
		echo "Run 'make deploy-infrastructure' first"; \
		exit 1; \
	fi; \
	aws s3 sync dist/ s3://$$BUCKET_NAME/ \
		--delete \
		--cache-control "public,max-age=31536000,immutable" \
		--exclude "index.html" \
		--exclude "*.txt"; \
	aws s3 cp dist/index.html s3://$$BUCKET_NAME/index.html \
		--cache-control "public,max-age=0,must-revalidate" \
		--content-type "text/html"; \
	if [ -f "dist/robots.txt" ]; then \
		aws s3 cp dist/robots.txt s3://$$BUCKET_NAME/robots.txt \
			--cache-control "public,max-age=3600" \
			--content-type "text/plain"; \
	fi
	@echo "$(GREEN)✓ Files uploaded$(NC)"

invalidate: ## Invalidate CloudFront cache
	@echo "$(GREEN)Invalidating CloudFront cache...$(NC)"
	@DISTRIBUTION_ID=$$(aws cloudformation describe-stacks \
		--stack-name "$(FRONTEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
		--output text); \
	if [ -z "$$DISTRIBUTION_ID" ]; then \
		echo "$(RED)Error: Could not find CloudFront distribution$(NC)"; \
		exit 1; \
	fi; \
	aws cloudfront create-invalidation \
		--distribution-id $$DISTRIBUTION_ID \
		--paths "/*" \
		--query 'Invalidation.Id' \
		--output text
	@echo "$(GREEN)✓ Cache invalidation started$(NC)"

deploy: build deploy-infrastructure upload invalidate ## Full deployment (build + infrastructure + upload + invalidate)
	@echo "$(GREEN)✓ Deployment complete!$(NC)"
	@$(MAKE) outputs

quick-deploy: build upload invalidate ## Quick deployment (build + upload + invalidate, skip infrastructure)
	@echo "$(GREEN)✓ Quick deployment complete!$(NC)"
	@$(MAKE) outputs

update-infrastructure: deploy-infrastructure invalidate ## Update only infrastructure (useful for CSP, security headers, etc.)
	@echo "$(GREEN)✓ Infrastructure updated$(NC)"

outputs: ## Show deployment outputs (URLs, bucket name, etc.)
	@echo ""
	@echo "$(GREEN)═══════════════════════════════════════════════$(NC)"
	@echo "$(GREEN)          Frontend Deployment Info$(NC)"
	@echo "$(GREEN)═══════════════════════════════════════════════$(NC)"
	@WEBSITE_URL=$$(aws cloudformation describe-stacks \
		--stack-name "$(FRONTEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" \
		--output text); \
	BUCKET_NAME=$$(aws cloudformation describe-stacks \
		--stack-name "$(FRONTEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
		--output text); \
	DISTRIBUTION_ID=$$(aws cloudformation describe-stacks \
		--stack-name "$(FRONTEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
		--output text); \
	API_URL=$$(aws cloudformation describe-stacks \
		--stack-name "$(BACKEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
		--output text); \
	echo "$(YELLOW)Website URL:$(NC)        $$WEBSITE_URL"; \
	echo "$(YELLOW)S3 Bucket:$(NC)          $$BUCKET_NAME"; \
	echo "$(YELLOW)Distribution ID:$(NC)    $$DISTRIBUTION_ID"; \
	echo "$(YELLOW)API URL:$(NC)            $$API_URL"; \
	echo "$(GREEN)═══════════════════════════════════════════════$(NC)"
	@echo ""

clean: ## Clean build artifacts
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	rm -rf dist/
	rm -f .env.production
	@echo "$(GREEN)✓ Cleaned$(NC)"

dev: ## Run local development server
	npm run dev

logs: ## Show CloudFront distribution status
	@DISTRIBUTION_ID=$$(aws cloudformation describe-stacks \
		--stack-name "$(FRONTEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
		--output text); \
	if [ -z "$$DISTRIBUTION_ID" ]; then \
		echo "$(RED)Error: Could not find CloudFront distribution$(NC)"; \
		exit 1; \
	fi; \
	aws cloudfront get-distribution --id $$DISTRIBUTION_ID \
		--query 'Distribution.[Id,Status,DomainName,LastModifiedTime]' \
		--output table

status: ## Check deployment status
	@echo "$(GREEN)Backend Stack Status:$(NC)"
	@aws cloudformation describe-stacks \
		--stack-name "$(BACKEND_STACK_NAME)" \
		--query 'Stacks[0].[StackName,StackStatus]' \
		--output table 2>/dev/null || echo "$(RED)Stack not found$(NC)"
	@echo ""
	@echo "$(GREEN)Frontend Stack Status:$(NC)"
	@aws cloudformation describe-stacks \
		--stack-name "$(FRONTEND_STACK_NAME)" \
		--query 'Stacks[0].[StackName,StackStatus]' \
		--output table 2>/dev/null || echo "$(RED)Stack not found$(NC)"

check-invalidation: ## Check status of CloudFront invalidations
	@DISTRIBUTION_ID=$$(aws cloudformation describe-stacks \
		--stack-name "$(FRONTEND_STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
		--output text); \
	if [ -z "$$DISTRIBUTION_ID" ]; then \
		echo "$(RED)Error: Could not find CloudFront distribution$(NC)"; \
		exit 1; \
	fi; \
	echo "$(GREEN)Recent invalidations:$(NC)"; \
	aws cloudfront list-invalidations \
		--distribution-id $$DISTRIBUTION_ID \
		--max-items 5 \
		--query 'InvalidationList.Items[*].[Id,Status,CreateTime]' \
		--output table

destroy: ## Delete the frontend stack (WARNING: destructive!)
	@echo "$(RED)WARNING: This will delete the entire frontend stack!$(NC)"
	@echo "Stack: $(FRONTEND_STACK_NAME)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "$(YELLOW)Emptying S3 bucket...$(NC)"; \
		BUCKET_NAME=$$(aws cloudformation describe-stacks \
			--stack-name "$(FRONTEND_STACK_NAME)" \
			--query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
			--output text); \
		aws s3 rm s3://$$BUCKET_NAME/ --recursive; \
		echo "$(YELLOW)Deleting stack...$(NC)"; \
		aws cloudformation delete-stack --stack-name "$(FRONTEND_STACK_NAME)"; \
		echo "$(GREEN)Stack deletion initiated$(NC)"; \
	else \
		echo "$(GREEN)Cancelled$(NC)"; \
	fi
