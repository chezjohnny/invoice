.DEFAULT_GOAL := help

NODE_VERSION := $(shell cat .nvmrc | tr -d '[:space:]')
NODE_CURRENT := $(shell node -v 2>/dev/null | tr -d 'v\n ')

.PHONY: check-node
check-node:
	@[ "$(NODE_CURRENT)" = "$(NODE_VERSION)" ] || \
		{ echo "Wrong Node version ($(NODE_CURRENT)), expected $(NODE_VERSION). Run: nvm use"; exit 1; }

# ── Docker ──────────────────────────────────────────────────────────────────

.PHONY: up
up: ## Start all services (PostgreSQL + backend + frontend)
	docker compose up -d

.PHONY: up-db
up-db: ## Start PostgreSQL only
	docker compose up -d db

.PHONY: down
down: ## Stop all services
	docker compose down

.PHONY: logs
logs: ## Follow backend logs
	docker compose logs -f backend

.PHONY: logs-all
logs-all: ## Follow all service logs
	docker compose logs -f

# ── Backend ─────────────────────────────────────────────────────────────────

.PHONY: backend-dev
backend-dev: ## Start backend dev server (hot reload, requires DB running)
	uv --directory backend run fastapi dev app/main.py

.PHONY: backend-dev-sqlite
backend-dev-sqlite: ## Start backend dev server with SQLite (no Docker needed)
	uv --directory backend run --env-file .env.sqlite fastapi dev app/main.py

.PHONY: backend-migrate
backend-migrate: ## Apply all pending DB migrations
	uv --directory backend run alembic upgrade head

.PHONY: backend-migration
backend-migration: ## Create a new migration (usage: make backend-migration MSG="add articles table")
	uv --directory backend run alembic revision --autogenerate -m "$(MSG)"

.PHONY: backend-fixtures-generate
backend-fixtures-generate: ## Regenerate fixtures/demo.json from the generator script
	uv --directory backend run python fixtures/generate.py

.PHONY: backend-fixtures
backend-fixtures: ## Load demo fixtures into the DB (add ARGS=--reset to wipe and reload)
	uv --directory backend run python -m app.cli load-fixtures $(ARGS)

.PHONY: backend-init-db-sqlite
backend-init-db-sqlite: ## Create SQLite dev DB tables
	uv --directory backend run --env-file .env.sqlite python -m app.cli init-db

.PHONY: backend-fixtures-sqlite
backend-fixtures-sqlite: backend-init-db-sqlite ## Load demo fixtures into SQLite dev DB (add ARGS=--reset to wipe and reload)
	uv --directory backend run --env-file .env.sqlite python -m app.cli load-fixtures $(ARGS)

.PHONY: backend-shell
backend-shell: ## Interactive shell with app + DB preloaded (uses default/Postgres)
	uv --directory backend run python -m app.cli shell

.PHONY: backend-shell-sqlite
backend-shell-sqlite: ## Interactive shell with app + DB preloaded (SQLite dev DB)
	uv --directory backend run --env-file .env.sqlite python -m app.cli shell

.PHONY: backend-test
backend-test: ## Run backend tests
	uv --directory backend run pytest

.PHONY: backend-test-cov
backend-test-cov: ## Run backend tests with coverage
	uv --directory backend run pytest --cov=app --cov-report=term-missing

.PHONY: backend-lint
backend-lint: ## Lint backend code
	uv --directory backend run ruff check app/

.PHONY: backend-fmt
backend-fmt: ## Format backend code
	uv --directory backend run ruff format app/

.PHONY: backend-typecheck
backend-typecheck: ## Type-check backend code
	uv --directory backend run mypy app/ --ignore-missing-imports

.PHONY: backend-check
backend-check: backend-lint backend-typecheck backend-test ## Lint + typecheck + tests

# ── Frontend ─────────────────────────────────────────────────────────────────

.PHONY: frontend-dev
frontend-dev: check-node ## Start frontend dev server (connects to backend at localhost:8000)
	npm --prefix frontend start

.PHONY: frontend-mock
frontend-mock: check-node ## Start frontend dev server with mock services (no backend needed)
	npm --prefix frontend run start:mock

.PHONY: frontend-test
frontend-test: check-node ## Run frontend tests (vitest, non-interactive)
	cd frontend && npx vitest run

.PHONY: frontend-build
frontend-build: check-node ## Build frontend for production
	npm --prefix frontend run build

# ── Full stack ────────────────────────────────────────────────────────────────

.PHONY: dev
dev: up-db ## Start DB + backend + frontend with real backend
	@echo "Starting backend and frontend..."
	@$(MAKE) -j2 backend-dev-sqlite frontend-dev

.PHONY: dev-mock
dev-mock: ## Start frontend only with mock services (no backend/DB needed)
	$(MAKE) frontend-mock

.PHONY: check
check: backend-check frontend-test frontend-build ## Run all checks (backend + frontend)

# ── Help ──────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
