.PHONY: help build deploy enable-signups disable-signups check-signups quick-update outputs status

# Environment configuration
ENV ?= dev
STACK_NAME = math-tutor-$(ENV)
REGION ?= us-east-1

# Colors for output
RED = \033[0;31m
GREEN = \033[0;32m
YELLOW = \033[1;33m
BLUE = \033[0;34m
NC = \033[0m # No Color

help: ## Show this help message
	@echo "$(GREEN)Math Tutor Backend Makefile$(NC)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}'

build: ## Build the backend application
	@echo "$(GREEN)Building backend...$(NC)"
	sam build
	@echo "$(GREEN)✓ Build complete$(NC)"

deploy: ## Deploy the backend stack
	@echo "$(GREEN)Deploying backend stack...$(NC)"
	sam build && sam deploy --resolve-s3 --no-confirm-changeset
	@echo "$(GREEN)✓ Deployment complete$(NC)"
	@$(MAKE) outputs

quick-update: ## Quick update (build and deploy without changing parameters)
	@echo "$(GREEN)Quick update of backend...$(NC)"
	@$(MAKE) build
	@$(MAKE) deploy
	@echo "$(GREEN)✓ Quick update complete$(NC)"

enable-signups: ## Enable new user signups (quick deployment)
	@echo "$(BLUE)Enabling signups...$(NC)"
	@sam build
	@sam deploy \
		--resolve-s3 \
		--no-confirm-changeset \
		--parameter-overrides \
			Environment=$(ENV) \
			AllowSignups=true
	@echo "$(GREEN)✓ Signups enabled$(NC)"
	@echo "$(BLUE)Verifying...$(NC)"
	@$(MAKE) check-signups

disable-signups: ## Disable new user signups (quick deployment)
	@echo "$(YELLOW)Disabling signups...$(NC)"
	@sam build
	@sam deploy \
		--resolve-s3 \
		--no-confirm-changeset \
		--parameter-overrides \
			Environment=$(ENV) \
			AllowSignups=false
	@echo "$(GREEN)✓ Signups disabled$(NC)"
	@echo "$(BLUE)Verifying...$(NC)"
	@$(MAKE) check-signups

check-signups: ## Check current signup status
	@echo "$(BLUE)Checking signup status...$(NC)"
	@ALLOW_SIGNUPS=$$(aws cloudformation describe-stacks \
		--stack-name "$(STACK_NAME)" \
		--query "Stacks[0].Parameters[?ParameterKey=='AllowSignups'].ParameterValue" \
		--output text 2>/dev/null); \
	if [ "$$ALLOW_SIGNUPS" = "true" ]; then \
		echo "$(GREEN)✓ Signups are ENABLED$(NC)"; \
	elif [ "$$ALLOW_SIGNUPS" = "false" ]; then \
		echo "$(YELLOW)✗ Signups are DISABLED$(NC)"; \
	else \
		echo "$(RED)? Could not determine signup status$(NC)"; \
	fi

test-signup-enabled: ## Test if signups work (make a test API call)
	@echo "$(BLUE)Testing signup endpoint...$(NC)"
	@API_URL=$$(aws cloudformation describe-stacks \
		--stack-name "$(STACK_NAME)" \
		--query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
		--output text); \
	RESPONSE=$$(curl -s -X POST "$$API_URL/api/users/register" \
		-H "Content-Type: application/json" \
		-d '{"cognitoId":"test","email":"test@test.com","ageGroup":"8-10"}' \
		-w "\n%{http_code}"); \
	HTTP_CODE=$$(echo "$$RESPONSE" | tail -n1); \
	BODY=$$(echo "$$RESPONSE" | head -n-1); \
	if [ "$$HTTP_CODE" = "403" ]; then \
		echo "$(YELLOW)Signups are disabled (403 Forbidden)$(NC)"; \
	elif [ "$$HTTP_CODE" = "400" ]; then \
		echo "$(GREEN)Signups are enabled (400 indicates validation, not disabled)$(NC)"; \
	else \
		echo "$(BLUE)HTTP $$HTTP_CODE:$(NC) $$BODY"; \
	fi

outputs: ## Show stack outputs (API URL, Cognito info, etc.)
	@echo ""
	@echo "$(GREEN)═══════════════════════════════════════════════$(NC)"
	@echo "$(GREEN)          Backend Stack Outputs$(NC)"
	@echo "$(GREEN)═══════════════════════════════════════════════$(NC)"
	@aws cloudformation describe-stacks \
		--stack-name "$(STACK_NAME)" \
		--query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
		--output table
	@echo ""
	@echo "$(BLUE)Parameters:$(NC)"
	@aws cloudformation describe-stacks \
		--stack-name "$(STACK_NAME)" \
		--query 'Stacks[0].Parameters[*].[ParameterKey,ParameterValue]' \
		--output table

status: ## Show stack status
	@echo "$(GREEN)Stack Status:$(NC)"
	@aws cloudformation describe-stacks \
		--stack-name "$(STACK_NAME)" \
		--query 'Stacks[0].[StackName,StackStatus,LastUpdatedTime]' \
		--output table 2>/dev/null || echo "$(RED)Stack not found$(NC)"

logs: ## Show recent Lambda logs for RegisterUserFunction
	@echo "$(GREEN)Recent logs for RegisterUserFunction:$(NC)"
	@FUNCTION_NAME=$$(aws cloudformation describe-stack-resource \
		--stack-name "$(STACK_NAME)" \
		--logical-resource-id RegisterUserFunction \
		--query 'StackResourceDetail.PhysicalResourceId' \
		--output text); \
	aws logs tail "/aws/lambda/$$FUNCTION_NAME" --follow

clean: ## Clean build artifacts
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	rm -rf .aws-sam/
	@echo "$(GREEN)✓ Cleaned$(NC)"

validate: ## Validate the CloudFormation template
	@echo "$(GREEN)Validating template...$(NC)"
	sam validate
	@echo "$(GREEN)✓ Template is valid$(NC)"

local-api: ## Run API Gateway locally for testing
	@echo "$(GREEN)Starting local API...$(NC)"
	sam local start-api

destroy: ## Delete the backend stack (WARNING: destructive!)
	@echo "$(RED)WARNING: This will delete the entire backend stack and ALL DATA!$(NC)"
	@echo "Stack: $(STACK_NAME)"
	@read -p "Type the stack name to confirm: " -r CONFIRM; \
	if [ "$$CONFIRM" = "$(STACK_NAME)" ]; then \
		echo "$(YELLOW)Deleting stack...$(NC)"; \
		aws cloudformation delete-stack --stack-name "$(STACK_NAME)"; \
		echo "$(GREEN)Stack deletion initiated$(NC)"; \
		echo "$(BLUE)Monitor progress:$(NC) aws cloudformation describe-stacks --stack-name $(STACK_NAME)"; \
	else \
		echo "$(GREEN)Cancelled (name didn't match)$(NC)"; \
	fi
