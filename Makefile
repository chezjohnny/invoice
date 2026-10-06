.DEFAULT_GOAL := help

NODE_VERSION := $(shell cat .nvmrc | tr -d '[:space:]')
NODE_CURRENT := $(shell node -v 2>/dev/null | tr -d 'v\n ')

COMPOSE := docker compose -f docker-compose.dev.yml

.PHONY: check-node
check-node:
	@[ "$(NODE_CURRENT)" = "$(NODE_VERSION)" ] || \
		{ echo "Wrong Node version ($(NODE_CURRENT)), expected $(NODE_VERSION). Run: nvm use"; exit 1; }

# ── Docker ──────────────────────────────────────────────────────────────────

.PHONY: up
up: ## Start backend + frontend in Docker (SQLite, hot reload)
	$(COMPOSE) up -d --build

.PHONY: down
down: ## Stop the Docker stack
	$(COMPOSE) down

.PHONY: logs
logs: ## Follow backend logs
	$(COMPOSE) logs -f backend

.PHONY: logs-all
logs-all: ## Follow all service logs
	$(COMPOSE) logs -f

# ── Backend ─────────────────────────────────────────────────────────────────
# Every target uses the SQLite dev DB, backend/dev.db.

.PHONY: backend-dev
backend-dev: backend-migrate ## Start backend dev server (hot reload)
	uv --directory backend run uvicorn app.main:app --reload

.PHONY: backend-migrate
backend-migrate: ## Apply all pending DB migrations
	uv --directory backend run alembic upgrade head

.PHONY: backend-migration
backend-migration: backend-migrate ## Create a new migration (usage: make backend-migration MSG="add articles table")
	uv --directory backend run alembic revision --autogenerate -m "$(MSG)"

.PHONY: backend-fixtures-generate
backend-fixtures-generate: ## Regenerate fixtures/demo.json from the generator script
	uv --directory backend run python fixtures/generate.py

.PHONY: backend-fixtures
backend-fixtures: backend-migrate ## Load demo fixtures (add ARGS=--reset to wipe and reload)
	uv --directory backend run python -m app.cli load-fixtures $(ARGS)

.PHONY: backend-create-tenant
backend-create-tenant: backend-migrate ## Create a tenant and its admin (NAME=... SUBDOMAIN=... EMAIL=...; asks for the password)
	uv --directory backend run python -m app.cli create-tenant --name "$(NAME)" --subdomain "$(SUBDOMAIN)" --email "$(EMAIL)"

.PHONY: backend-create-tenant-prod
backend-create-tenant-prod: ## Run from the production checkout on the VPS (NAME=... SUBDOMAIN=... EMAIL=...)
	docker compose run --rm --no-deps api python -m app.cli create-tenant --name "$(NAME)" --subdomain "$(SUBDOMAIN)" --email "$(EMAIL)"

.PHONY: backend-set-password
backend-set-password: backend-migrate ## Change a user's password (EMAIL=... [ARGS=--sign-out]; asks for the new one)
	uv --directory backend run python -m app.cli set-password --email "$(EMAIL)" $(ARGS)

.PHONY: backend-set-password-prod
backend-set-password-prod: ## Run from the production checkout on the VPS (EMAIL=... [ARGS=--sign-out])
	docker compose run --rm --no-deps api python -m app.cli set-password --email "$(EMAIL)" $(ARGS)

.PHONY: backend-shell
backend-shell: ## Interactive shell with app + DB preloaded
	uv --directory backend run python -m app.cli shell

.PHONY: backend-test
backend-test: ## Run backend tests
	uv --directory backend run pytest

.PHONY: backend-test-cov
backend-test-cov: ## Run backend tests with coverage
	uv --directory backend run pytest --cov=app --cov-report=term-missing

.PHONY: backend-lint
backend-lint: ## Lint backend code and check its formatting
	uv --directory backend run ruff check .
	uv --directory backend run ruff format --check .

.PHONY: backend-fmt
backend-fmt: ## Format backend code and apply safe lint fixes
	uv --directory backend run ruff format .
	uv --directory backend run ruff check --fix .

.PHONY: backend-typecheck
backend-typecheck: ## Type-check backend code and tests
	uv --directory backend run mypy app tests

.PHONY: backend-audit
backend-audit: ## Check backend dependencies for known vulnerabilities (pip-audit, needs network)
	uv --directory backend run pip-audit --skip-editable

.PHONY: backend-migrations-check
backend-migrations-check: backend-migrate ## Fail if the models have changes no migration covers
	uv --directory backend run alembic check

.PHONY: backend-check
backend-check: backend-lint backend-typecheck backend-migrations-check backend-test backend-audit ## Lint + typecheck + migrations + tests + audit

# ── Frontend ─────────────────────────────────────────────────────────────────

.PHONY: frontend-dev
frontend-dev: check-node ## Start frontend dev server (connects to backend at localhost:8000)
	npm --prefix frontend start

.PHONY: frontend-mock
frontend-mock: check-node ## Start frontend dev server with mock services (no backend needed)
	npm --prefix frontend run start:mock

.PHONY: frontend-test
frontend-test: check-node ## Run frontend tests (ng test: Vitest on the AOT-compiled app, non-interactive)
	npm --prefix frontend test -- --watch=false

.PHONY: frontend-build
frontend-build: check-node ## Build frontend for production
	npm --prefix frontend run build

.PHONY: frontend-audit
frontend-audit: check-node ## Check frontend dependencies for known vulnerabilities (npm audit, needs network)
	npm --prefix frontend audit

.PHONY: frontend-lint
frontend-lint: check-node ## Lint frontend code and templates (ESLint + angular-eslint)
	npm --prefix frontend run lint

.PHONY: frontend-check
frontend-check: frontend-lint frontend-test frontend-build frontend-audit ## Lint + tests + production build + audit

# ── Full stack ────────────────────────────────────────────────────────────────

.PHONY: dev
dev: ## Start backend + frontend locally (no Docker)
	@$(MAKE) -j2 backend-dev frontend-dev

.PHONY: dev-mock
dev-mock: ## Start frontend only with mock services (no backend/DB needed)
	$(MAKE) frontend-mock

.PHONY: check
check: backend-check frontend-check ## Run all checks (backend + frontend)

# ── Help ──────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
